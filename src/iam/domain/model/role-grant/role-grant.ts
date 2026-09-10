// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { DomainError, type ClubId } from '../../../../Shared/index.js';
import type { UserId } from '../../shared/domain-ids.js';
import { RoleScope } from './value-objects/role-scope.js';

export type DomainRole = 'ShowSecretary' | 'Judge' | 'PlatformAdministrator';

/**
 * A revocable record that a User holds a named {@link DomainRole} within a
 * stated scope: Club-scoped (`ShowSecretary`) or platform-global (`Judge` /
 * `PlatformAdministrator`). Created/revoked only by a Platform Administrator.
 *
 * Modelled as a class aggregate (ADR-0022/0024): the role↔scope correlation is
 * enforced by **per-role factories** (the wrong pairing is uncallable from
 * domain code — there is no scope parameter where the role determines the
 * scope) plus a **constructor guard** that throws {@link InvalidRoleScopeError}
 * on a wrong pair — defence-in-depth for the {@link RoleGrant.rehydrate}
 * storage-load path. A private `#brand` field makes the class **nominal** so a
 * bare `{ userId, role, scope }` object literal (the TS structural-literal leak
 * a `private constructor` cannot block on its own) is not assignable to
 * `RoleGrant` — the type is closed against unvalidated construction (mirrors
 * `LocalDate`). The compile-time "impossible states" guarantee of the
 * superseded discriminated-union aggregate (ADR-0012) is traded for runtime
 * validation, pinned by a test.
 *
 * The class also owns its collection behaviours as static methods
 * ({@link RoleGrant.grant}/{@link RoleGrant.revoke}/{@link RoleGrant.has}/
 * {@link RoleGrant.assertOwnedBy}) so the aggregate is not anemic — no
 * external-function module operates on `RoleGrant[]` (ADR-0024).
 */
export class RoleGrant {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `RoleGrant` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly userId: UserId;

    readonly role: DomainRole;

    readonly scope: RoleScope;

    private constructor(userId: UserId, role: DomainRole, scope: RoleScope) {
        if (!isPairingValid(role, scope)) {
            throw new InvalidRoleScopeError(role, scope);
        }
        this.userId = userId;
        this.role = role;
        this.scope = scope;
    }

    static showSecretary(userId: UserId, clubId: ClubId): RoleGrant {
        return new RoleGrant(userId, 'ShowSecretary', RoleScope.club(clubId));
    }

    static judge(userId: UserId): RoleGrant {
        return new RoleGrant(userId, 'Judge', RoleScope.platform());
    }

    static platformAdministrator(userId: UserId): RoleGrant {
        return new RoleGrant(userId, 'PlatformAdministrator', RoleScope.platform());
    }

    /**
     * Rehydrate a {@link RoleGrant} from storage. Runs the same role↔scope guard
     * as the per-role factories so a corrupt row is rejected rather than
     * rehydrated into an invalid aggregate (V2).
     */
    static rehydrate(userId: UserId, role: DomainRole, scope: RoleScope): RoleGrant {
        return new RoleGrant(userId, role, scope);
    }

    /**
     * Returns a new collection with `newGrant` appended.
     * Throws {@link DuplicateRoleGrantError} when the same userId + role + scope already exists.
     */
    static grant(all: readonly RoleGrant[], newGrant: RoleGrant): readonly RoleGrant[] {
        if (all.some((g) => RoleGrant.grantsMatch(g, newGrant))) {
            throw new DuplicateRoleGrantError(newGrant);
        }
        return [...all, newGrant];
    }

    /**
     * Returns a new collection with the matching grant removed.
     * No-op when no matching grant exists — the desired state (grant absent) is already met.
     */
    static revoke(all: readonly RoleGrant[], target: RoleGrant): readonly RoleGrant[] {
        return all.filter((g) => !RoleGrant.grantsMatch(g, target));
    }

    /**
     * Resolution helper for downstream ACL adapters.
     * Returns `true` when `all` contains an entry for `userId` with the given role and scope.
     *
     * Note: The Exhibitor capability is NOT a role grant. Any Active User is implicitly
     * an Exhibitor; ACL adapters check `user.status === 'Active'` instead of `has`.
     */
    static has(all: readonly RoleGrant[], userId: UserId, grantKey: RoleGrantKey): boolean {
        return all.some(
            (g) =>
                g.userId === userId && g.role === grantKey.role && g.scope.equals(grantKey.scope),
        );
    }

    /**
     * Reusable domain-level check for the `RoleGrantRepository.saveAll` owner-mismatch
     * invariant. Throws {@link RoleGrantOwnerMismatchError} when any grant in
     * `all` belongs to a user other than `userId`.
     *
     * This is the shared, repository-agnostic way to honour the `saveAll`
     * "throws on owner mismatch" contract, so adapters reuse one check instead of
     * re-implementing it. The interface cannot force the call and the domain suite
     * cannot detect an adapter that omits it — each `saveAll` implementation
     * remains responsible for invoking this (or an equivalent) check to satisfy
     * the contract.
     */
    static assertOwnedBy(userId: UserId, all: readonly RoleGrant[]): void {
        for (const grant of all) {
            if (grant.userId !== userId) throw new RoleGrantOwnerMismatchError(userId, grant);
        }
    }

    private static grantsMatch(a: RoleGrant, b: RoleGrant): boolean {
        return a.userId === b.userId && a.role === b.role && a.scope.equals(b.scope);
    }
}

/**
 * Thrown when a {@link RoleGrant} is constructed/rehydrated with a role↔scope
 * pairing the domain does not allow (`ShowSecretary`⇄club scope with a
 * `clubId`; `Judge`/`PlatformAdministrator`⇄platform scope with no `clubId`).
 * The `clubId` context records whether a club id was missing (a club scope
 * without one) or extra (a platform scope carrying one) so the failure is
 * diagnosable.
 */
export class InvalidRoleScopeError extends DomainError {
    readonly role: DomainRole;

    readonly scopeKind: RoleScope['kind'];

    readonly clubId: ClubId | undefined;

    constructor(role: DomainRole, scope: RoleScope) {
        super(
            `RoleGrant role '${role}' is invalid for a '${scope.kind}' scope (clubId ${scope.clubId === undefined ? 'missing' : 'present'})`,
            { role, scopeKind: scope.kind, clubId: scope.clubId },
        );
        this.role = role;
        this.scopeKind = scope.kind;
        this.clubId = scope.clubId;
    }
}

/**
 * The role↔scope correlation rule (ADR-0012, restated as a runtime check per
 * ADR-0024). Checks both the `kind` pairing and the `clubId` presence/absence
 * it implies: a club scope must carry a `clubId`, a platform scope must not.
 */
function isPairingValid(role: DomainRole, scope: RoleScope): boolean {
    if (role === 'ShowSecretary') return scope.kind === 'club' && scope.clubId !== undefined;
    return scope.kind === 'platform' && scope.clubId === undefined;
}

/** Role+scope lookup key for {@link RoleGrant.has}. Flat (no compile-time role↔scope pairing); the pairing is enforced on the RoleGrant aggregate (ADR-0024). */
export type RoleGrantKey = { readonly role: DomainRole; readonly scope: RoleScope };

export class DuplicateRoleGrantError extends DomainError {
    readonly grant: RoleGrant;

    constructor(grant: RoleGrant) {
        super(`User ${grant.userId} already holds role ${grant.role} in the given scope`, {
            userId: grant.userId,
            role: grant.role,
        });
        this.grant = grant;
    }
}

export class RoleGrantOwnerMismatchError extends DomainError {
    readonly userId: UserId;
    readonly grant: RoleGrant;

    constructor(userId: UserId, grant: RoleGrant) {
        super(`Grant for user ${grant.userId} passed to saveAll for user ${userId}`, {
            userId,
            grantUserId: grant.userId,
        });
        this.userId = userId;
        this.grant = grant;
    }
}
