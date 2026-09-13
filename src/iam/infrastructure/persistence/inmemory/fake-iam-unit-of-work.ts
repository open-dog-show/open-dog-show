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

    async run<T>(
        _scope: TransactionScope,
        body: (ctx: IamUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        const pendingFacts: DomainEventFact[] = [];
        const record = (...facts: readonly DomainEventFact[]): void => {
            pendingFacts.push(...facts);
        };

        // Remembers each key's value from just before this attempt first
        // touched it, so a thrown body can roll back precisely — see the
        // class doc for why a whole-collection snapshot is wrong here.
        const priorUsers = new Map<UserId, User | undefined>();
        const rememberUser = (id: UserId): void => {
            if (!priorUsers.has(id)) priorUsers.set(id, this.users.get(id));
        };
        const priorRoleGrants = new Map<UserId, UserRoleGrants | undefined>();
        const rememberRoleGrants = (id: UserId): void => {
            if (!priorRoleGrants.has(id)) priorRoleGrants.set(id, this.roleGrants.get(id));
        };

        // Records what *this* attempt itself last wrote per key (the exact
        // instance stored into the committed map), so a rollback can tell
        // "still my write" from "someone else already committed on top of
        // it" — see the class doc.
        const writtenUsers = new Map<UserId, User>();
        const writtenRoleGrants = new Map<UserId, UserRoleGrants>();

        const ctx: IamUnitOfWorkContext = {
            users: {
                findById: async (id) => this.users.get(id),
                findByExternalSubject: async (subject) => {
                    for (const user of this.users.values()) {
                        if (user.externalSubject === subject) return user;
                    }
                    return undefined;
                },
                add: async (user) => {
                    for (const existing of this.users.values()) {
                        if (existing.externalSubject === user.externalSubject) {
                            throw new DuplicateExternalSubjectError(user.externalSubject);
                        }
                    }
                    rememberUser(user.id);
                    this.users.set(user.id, user);
                    writtenUsers.set(user.id, user);
                },
                update: async (user) => {
                    const stored = this.users.get(user.id);
                    if (stored === undefined || stored.version !== user.version) {
                        throw new ConcurrentModificationError('User', user.id, user.version);
                    }
                    rememberUser(user.id);
                    const bumped = User.rehydrate({ ...user, version: user.version + 1 });
                    this.users.set(user.id, bumped);
                    writtenUsers.set(user.id, bumped);
                },
            },
            userRoleGrants: {
                // Returns a fresh copy, never the stored instance itself:
                // unlike `User` (immutable — every mutator returns a new
                // instance), `UserRoleGrants` mutates its own `#grants` array
                // in place (`grant`/`revoke`), so handing out the live
                // reference would let one reader's in-progress mutation leak
                // into another concurrent reader's copy of "the version they
                // loaded" before either has written anything back.
                findByUser: async (userId) => {
                    const stored = this.roleGrants.get(userId);
                    return stored === undefined
                        ? UserRoleGrants.empty(userId)
                        : UserRoleGrants.rehydrate({
                              userId: stored.userId,
                              version: stored.version,
                              grants: stored.grants,
                          });
                },
                add: async (roleGrants) => {
                    if (this.roleGrants.has(roleGrants.userId)) {
                        throw new ConcurrentModificationError(
                            'UserRoleGrants',
                            roleGrants.userId,
                            roleGrants.version,
                        );
                    }
                    rememberRoleGrants(roleGrants.userId);
                    const stored = UserRoleGrants.rehydrate({
                        userId: roleGrants.userId,
                        version: 1,
                        grants: roleGrants.grants,
                    });
                    this.roleGrants.set(roleGrants.userId, stored);
                    writtenRoleGrants.set(roleGrants.userId, stored);
                    record(...roleGrants.pullEvents());
                },
                update: async (roleGrants) => {
                    const current = this.roleGrants.get(roleGrants.userId);
                    if (current === undefined || current.version !== roleGrants.version) {
                        throw new ConcurrentModificationError(
                            'UserRoleGrants',
                            roleGrants.userId,
                            roleGrants.version,
                        );
                    }
                    rememberRoleGrants(roleGrants.userId);
                    const bumped = UserRoleGrants.rehydrate({
                        userId: roleGrants.userId,
                        version: current.version + 1,
                        grants: roleGrants.grants,
                    });
                    this.roleGrants.set(roleGrants.userId, bumped);
                    writtenRoleGrants.set(roleGrants.userId, bumped);
                    record(...roleGrants.pullEvents());
                },
            },
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
            for (const [id, prior] of priorUsers) {
                // Only restore if the row is still exactly what this attempt
                // wrote — otherwise a later, already-committed attempt built
                // on top of it, and undoing here would erase that commit.
                if (this.users.get(id) !== writtenUsers.get(id)) continue;
                if (prior === undefined) this.users.delete(id);
                else this.users.set(id, prior);
            }
            for (const [id, prior] of priorRoleGrants) {
                if (this.roleGrants.get(id) !== writtenRoleGrants.get(id)) continue;
                if (prior === undefined) this.roleGrants.delete(id);
                else this.roleGrants.set(id, prior);
            }
            throw error;
        }
    }
}
