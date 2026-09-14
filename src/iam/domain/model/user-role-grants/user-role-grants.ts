// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    AggregateRoot,
    asAggregateId,
    DomainError,
    PlatformEventScope,
    type ClubId,
} from '../../../../Shared/index.js';
import type { UserId } from '../../shared/domain-ids.js';
import { RoleGrant, type DomainRole } from '../role-grant/role-grant.js';
import type { RoleScope } from '../role-grant/value-objects/role-scope.js';
import { RoleGranted } from './events/role-granted.js';
import { RoleRevoked } from './events/role-revoked.js';

/**
 * The aggregate root for one user's role grants (ADR-0026/#189, review
 * findings Aggregates #2/#5).
 *
 * Identified by `UserId` and versioned for optimistic concurrency (mirrors
 * `User`): two concurrent grant/revoke attempts that both load the same
 * stale version race on `UserRoleGrantsRepository.update`, and the second
 * write loses with `ConcurrentModificationError` rather than silently
 * dropping the first writer's change (the "lost revoke" scenario).
 *
 * Replaces a prior revision where `RoleGrant` carried its own `userId` and a
 * bag of static functions (`grant`/`revoke`/`has`/`assertOwnedBy`) operated
 * on a bare `RoleGrant[]` — an anemic collection with no aggregate boundary
 * to enforce the "no duplicate grant" invariant transactionally. Here, the
 * per-role grant methods and {@link revoke} are instance methods that decide
 * *whether* the change is allowed and record the resulting fact
 * (`RoleGranted`/`RoleRevoked`, both `EventScope.platform()` — role-grant
 * data is platform-owned regardless of which Club a `ShowSecretary` grant
 * names, ADR-0005).
 *
 * A private `#brand` field makes the class **nominal** (mirrors `User`) so a
 * bare `{ userId, version, grants }` object literal is not assignable to
 * `UserRoleGrants`.
 */
export class UserRoleGrants extends AggregateRoot {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `UserRoleGrants` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    #grants: RoleGrant[];

    readonly userId: UserId;

    /** Optimistic-concurrency stamp. `0` marks a root that has never been persisted (see {@link empty}). */
    readonly version: number;

    /** A defensive copy — callers cannot mutate the aggregate's internals through the returned array. */
    get grants(): readonly RoleGrant[] {
        return [...this.#grants];
    }

    private constructor(userId: UserId, version: number, grants: readonly RoleGrant[]) {
        super();
        assertNoDuplicateGrants(userId, grants);
        this.userId = userId;
        this.version = version;
        this.#grants = [...grants];
    }

    /**
     * The root for a user with no persisted grants yet — never `undefined`
     * (`UserRoleGrantsRepository.findByUser` returns this instead of an
     * absent value, N1). Version `0` — a sentinel a real persisted row never
     * carries, since the first successful `add` stores version `1`.
     */
    static empty(userId: UserId): UserRoleGrants {
        return new UserRoleGrants(userId, 0, []);
    }

    /** Rehydrate a {@link UserRoleGrants} from storage. No event is recorded. */
    static rehydrate(input: {
        readonly userId: UserId;
        readonly version: number;
        readonly grants: readonly RoleGrant[];
    }): UserRoleGrants {
        return new UserRoleGrants(input.userId, input.version, input.grants);
    }

    /** Grants `ShowSecretary` for `clubId`. Throws {@link DuplicateRoleGrantError} if already held. */
    grantShowSecretary(clubId: ClubId): void {
        this.grant(RoleGrant.showSecretary(clubId));
    }

    /** Grants platform-wide `Judge`. Throws {@link DuplicateRoleGrantError} if already held. */
    grantJudge(): void {
        this.grant(RoleGrant.judge());
    }

    /** Grants platform-wide `PlatformAdministrator`. Throws {@link DuplicateRoleGrantError} if already held. */
    grantPlatformAdministrator(): void {
        this.grant(RoleGrant.platformAdministrator());
    }

    /**
     * Removes the grant matching `role`+`scope`, recording `RoleRevoked`.
     * No-op (and records nothing) when no matching grant exists — the
     * desired state (grant absent) is already met.
     */
    revoke(role: DomainRole, scope: RoleScope): void {
        const target = this.#grants.find((g) => g.role === role && g.scope.equals(scope));
        if (target === undefined) return;
        this.#grants = this.#grants.filter((g) => g !== target);
        this.record(
            RoleRevoked.create(asAggregateId(this.userId), PlatformEventScope.of(), {
                role,
                clubId: scope.clubId,
            }),
        );
    }

    private grant(newGrant: RoleGrant): void {
        if (this.#grants.some((g) => g.equals(newGrant))) {
            throw new DuplicateRoleGrantError(this.userId, newGrant.role, newGrant.scope.clubId);
        }
        this.#grants.push(newGrant);
        this.record(
            RoleGranted.create(asAggregateId(this.userId), PlatformEventScope.of(), {
                role: newGrant.role,
                clubId: newGrant.scope.clubId,
            }),
        );
    }
}

/**
 * Constructor-time guard (mirrors {@link User}'s and {@link RoleGrant.rehydrate}'s
 * own construction-path validation): rejects a `grants` array carrying two
 * entries for the same role+scope. Without this, `rehydrate` could load an
 * aggregate that already violates the no-duplicate invariant `grant()`
 * enforces on every mutation, and `revoke` would then remove only one of the
 * duplicates while reporting a successful revocation.
 */
function assertNoDuplicateGrants(userId: UserId, grants: readonly RoleGrant[]): void {
    grants.forEach((grant, i) => {
        for (const other of grants.slice(i + 1)) {
            if (grant.equals(other)) {
                throw new DuplicateRoleGrantError(userId, grant.role, grant.scope.clubId);
            }
        }
    });
}

/**
 * Thrown by {@link UserRoleGrants.prototype.grantShowSecretary} /
 * {@link UserRoleGrants.prototype.grantJudge} /
 * {@link UserRoleGrants.prototype.grantPlatformAdministrator} when the user
 * already holds that exact role+scope.
 *
 * Carries **primitive context only** (`userId`, `role`, `clubId`) — no
 * `RoleGrant` or `UserRoleGrants` reference — so no IAM domain error holds an
 * aggregate reference (review finding Domain Model #6).
 */
export class DuplicateRoleGrantError extends DomainError {
    readonly userId: UserId;
    readonly role: DomainRole;
    readonly clubId: ClubId | undefined;

    constructor(userId: UserId, role: DomainRole, clubId: ClubId | undefined) {
        super(
            `User ${userId} already holds role ${role}` +
                (clubId === undefined ? '' : ` in club ${clubId}`),
            { userId, role, clubId },
        );
        this.userId = userId;
        this.role = role;
        this.clubId = clubId;
    }
}
