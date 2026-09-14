// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    stampDomainEvent,
    type Clock,
    type DomainEvent,
    type DomainEventFact,
    type EventIdGenerator,
    type TransactionScope,
} from '../../../../Shared/index.js';
import { SystemClock } from '../../../../Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../Shared/infrastructure/random-event-id-generator.js';
import type {
    IamUnitOfWork,
    IamUnitOfWorkContext,
} from '../../../application/ports/unit-of-work.js';
import { User } from '../../../domain/model/user/user.js';
import { DuplicateExternalSubjectError } from '../../../domain/model/user/user-repository.js';
import { UserRoleGrants } from '../../../domain/model/user-role-grants/user-role-grants.js';
import { ConcurrentModificationError } from '../../../domain/shared/concurrent-modification-error.js';
import type { UserId } from '../../../domain/shared/domain-ids.js';

/**
 * Tracks writes to one committed `Map` so a thrown `body` can roll back
 * exactly the keys this attempt touched, restoring each to its value from
 * immediately before the attempt — see {@link FakeIamUnitOfWork}'s class doc
 * for why a whole-collection snapshot is wrong here. `rollback` is itself a
 * compare-and-restore: a key is only restored when its current committed
 * value is still exactly the instance this attempt itself last wrote there
 * (reference equality), so a later, already-committed attempt that built on
 * top of it is left alone.
 */
class RollbackTrackedMap<K, V> {
    private readonly prior = new Map<K, V | undefined>();
    private readonly written = new Map<K, V>();

    constructor(private readonly committed: Map<K, V>) {}

    remember(id: K): void {
        if (!this.prior.has(id)) this.prior.set(id, this.committed.get(id));
    }

    write(id: K, value: V): void {
        this.committed.set(id, value);
        this.written.set(id, value);
    }

    rollback(): void {
        for (const [id, prior] of this.prior) {
            if (this.committed.get(id) !== this.written.get(id)) continue;
            if (prior === undefined) this.committed.delete(id);
            else this.committed.set(id, prior);
        }
    }
}

/**
 * In-memory {@link IamUnitOfWork} for unit-testing IAM use cases without
 * Docker (ADR-0014). No Postgres implementation exists yet (#189).
 *
 * Unlike `FakeSampleUnitOfWork` — which stages a full copy of every
 * collection at the start of `run` and only replaces the committed arrays
 * once `body` resolves — IAM's `User`/`UserRoleGrants` are versioned for
 * optimistic concurrency, and that has to be provable without a real
 * database: a stale `update` must fail against whatever is *currently*
 * committed, even when the conflicting write came from a `run` call that
 * started later and already finished. So this fake mutates its committed
 * `Map`s directly (no staging copy) and, only if `body` throws, rolls back
 * exactly the keys this attempt touched — restoring each to its value from
 * immediately before this attempt — rather than restoring a whole-collection
 * snapshot that could clobber an unrelated key some other, already-committed
 * attempt wrote to in the meantime.
 *
 * That per-key restore is itself a compare-and-restore, not an unconditional
 * one: a restore only applies when the key's current value is still exactly
 * what *this* attempt itself last wrote there. Because a write is visible
 * the instant it happens (there is no staging), a second `run` can read this
 * attempt's not-yet-resolved write, build on it, and fully commit before this
 * attempt later throws — restoring unconditionally would then erase that
 * later, already-committed write. Comparing against what this attempt itself
 * wrote (reference equality — every write stores a freshly-constructed
 * instance) detects exactly that "someone already built on top of me" case
 * and leaves the row alone instead.
 */
export class FakeIamUnitOfWork implements IamUnitOfWork {
    readonly recordedEvents: DomainEvent[] = [];

    private readonly users = new Map<UserId, User>();
    private readonly roleGrants = new Map<UserId, UserRoleGrants>();

    constructor(
        private readonly clock: Clock = new SystemClock(),
        private readonly eventIdGenerator: EventIdGenerator = new RandomEventIdGenerator(),
    ) {}

    private findUserByExternalSubject(subject: string): Promise<User | undefined> {
        for (const user of this.users.values()) {
            if (user.externalSubject === subject) return Promise.resolve(user);
        }
        return Promise.resolve(undefined);
    }

    private addUser(users: RollbackTrackedMap<UserId, User>, user: User): Promise<void> {
        for (const existing of this.users.values()) {
            if (existing.externalSubject === user.externalSubject) {
                throw new DuplicateExternalSubjectError(user.externalSubject);
            }
        }
        users.remember(user.id);
        users.write(user.id, user);
        return Promise.resolve();
    }

    private updateUser(users: RollbackTrackedMap<UserId, User>, user: User): Promise<void> {
        const stored = this.users.get(user.id);
        if (stored?.version !== user.version) {
            throw new ConcurrentModificationError('User', user.id, user.version);
        }
        users.remember(user.id);
        users.write(
            user.id,
            User.rehydrate({
                id: user.id,
                displayName: user.displayName,
                email: user.email,
                status: user.status,
                externalSubject: user.externalSubject,
                version: user.version + 1,
            }),
        );
        return Promise.resolve();
    }

    private buildUsersPort(users: RollbackTrackedMap<UserId, User>): IamUnitOfWorkContext['users'] {
        return {
            findById: (id) => Promise.resolve(this.users.get(id)),
            findByExternalSubject: (subject) => this.findUserByExternalSubject(subject),
            add: (user) => this.addUser(users, user),
            update: (user) => this.updateUser(users, user),
        };
    }

    // Returns a fresh copy, never the stored instance itself: unlike `User`
    // (immutable — every mutator returns a new instance), `UserRoleGrants`
    // mutates its own `#grants` array in place (`grant`/`revoke`), so handing
    // out the live reference would let one reader's in-progress mutation leak
    // into another concurrent reader's copy of "the version they loaded"
    // before either has written anything back.
    private findRoleGrantsByUser(userId: UserId): Promise<UserRoleGrants> {
        const stored = this.roleGrants.get(userId);
        return Promise.resolve(
            stored === undefined
                ? UserRoleGrants.empty(userId)
                : UserRoleGrants.rehydrate({
                      userId: stored.userId,
                      version: stored.version,
                      grants: stored.grants,
                  }),
        );
    }

    private addRoleGrants(
        tracker: RollbackTrackedMap<UserId, UserRoleGrants>,
        record: (...facts: readonly DomainEventFact[]) => void,
        grants: UserRoleGrants,
    ): Promise<void> {
        if (this.roleGrants.has(grants.userId)) {
            throw new ConcurrentModificationError('UserRoleGrants', grants.userId, grants.version);
        }
        tracker.remember(grants.userId);
        const stored = UserRoleGrants.rehydrate({
            userId: grants.userId,
            version: 1,
            grants: grants.grants,
        });
        tracker.write(grants.userId, stored);
        record(...grants.pullEvents());
        return Promise.resolve();
    }

    private updateRoleGrants(
        tracker: RollbackTrackedMap<UserId, UserRoleGrants>,
        record: (...facts: readonly DomainEventFact[]) => void,
        grants: UserRoleGrants,
    ): Promise<void> {
        const current = this.roleGrants.get(grants.userId);
        if (current?.version !== grants.version) {
            throw new ConcurrentModificationError('UserRoleGrants', grants.userId, grants.version);
        }
        tracker.remember(grants.userId);
        tracker.write(
            grants.userId,
            UserRoleGrants.rehydrate({
                userId: grants.userId,
                version: current.version + 1,
                grants: grants.grants,
            }),
        );
        record(...grants.pullEvents());
        return Promise.resolve();
    }

    private buildUserRoleGrantsPort(
        roleGrants: RollbackTrackedMap<UserId, UserRoleGrants>,
        record: (...facts: readonly DomainEventFact[]) => void,
    ): IamUnitOfWorkContext['userRoleGrants'] {
        return {
            findByUser: (userId) => this.findRoleGrantsByUser(userId),
            add: (grants) => this.addRoleGrants(roleGrants, record, grants),
            update: (grants) => this.updateRoleGrants(roleGrants, record, grants),
        };
    }

    async run<T>(
        _scope: TransactionScope,
        body: (ctx: IamUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        const pendingFacts: DomainEventFact[] = [];
        const record = (...facts: readonly DomainEventFact[]): void => {
            pendingFacts.push(...facts);
        };

        const users = new RollbackTrackedMap(this.users);
        const roleGrants = new RollbackTrackedMap(this.roleGrants);
        const ctx: IamUnitOfWorkContext = {
            users: this.buildUsersPort(users),
            userRoleGrants: this.buildUserRoleGrantsPort(roleGrants, record),
        };

        try {
            const result = await body(ctx);
            for (const fact of pendingFacts) {
                this.recordedEvents.push(
                    stampDomainEvent(fact, this.eventIdGenerator.generate(), this.clock.now()),
                );
            }
            return result;
        } catch (error) {
            users.rollback();
            roleGrants.rollback();
            throw error;
        }
    }
}
