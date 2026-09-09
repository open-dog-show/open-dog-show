// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { DomainError, type ClubId } from '../../../../Shared/index.js';
import type { UserId } from '../../shared/domain-ids.js';

/**
 * Where a {@link RoleGrant} applies — a Club (carrying the owning `ClubId`) or
 * the whole platform. Modelled as a class-based **variant value object**
 * (ADR-0023): a discriminated union of value-object classes built solely
 * through their `of` factories (V2/V3). The role/scope correlation is still
 * enforced at compile time by the {@link RoleGrant} discriminated union
 * (ADR-0012, superseded by ADR-0022 only for the _aggregate_ shape — the
 * scope value object stays a variant VO per ADR-0023).
 */
export class ClubScope {
    readonly kind = 'club' as const;

    private constructor(readonly clubId: ClubId) {}

    static of(clubId: ClubId): ClubScope {
        return new ClubScope(clubId);
    }

    equals(other: ClubScope): boolean {
        return this.clubId === other.clubId;
    }
}

export class PlatformScope {
    readonly kind = 'platform' as const;

    private constructor() {}

    static of(): PlatformScope {
        return new PlatformScope();
    }

    equals(other: PlatformScope): boolean {
        return this.kind === other.kind;
    }
}

export type RoleScope = ClubScope | PlatformScope;

/**
 * Value equality for {@link RoleScope} — narrows both sides on `kind` before
 * delegating to the variant's {@link RoleScope#equals} (V3). Two Club scopes
 * are equal iff their `ClubId`s match; any two `PlatformScope`s are equal.
 */
export function roleScopesEqual(a: RoleScope, b: RoleScope): boolean {
    switch (a.kind) {
        case 'club':
            return b.kind === 'club' && a.equals(b);
        case 'platform':
            return b.kind === 'platform' && a.equals(b);
    }
}

export type DomainRole = 'ShowSecretary' | 'Judge' | 'PlatformAdministrator';

export type RoleGrant =
    | { readonly userId: UserId; readonly role: 'ShowSecretary'; readonly scope: ClubScope }
    | {
          readonly userId: UserId;
          readonly role: 'Judge' | 'PlatformAdministrator';
          readonly scope: PlatformScope;
      };

/** Role+scope lookup key for hasRole. Preserves the role/scope correlation from RoleGrant. */
export type RoleGrantKey =
    | { readonly role: 'ShowSecretary'; readonly scope: ClubScope }
    | { readonly role: 'Judge' | 'PlatformAdministrator'; readonly scope: PlatformScope };

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

function grantsMatch(a: RoleGrant, b: RoleGrant): boolean {
    return a.userId === b.userId && a.role === b.role && roleScopesEqual(a.scope, b.scope);
}

/**
 * Returns a new collection with `newGrant` appended.
 * Throws {@link DuplicateRoleGrantError} when the same userId + role + scope already exists.
 */
export function grantRole(grants: readonly RoleGrant[], newGrant: RoleGrant): readonly RoleGrant[] {
    if (grants.some((g) => grantsMatch(g, newGrant))) {
        throw new DuplicateRoleGrantError(newGrant);
    }
    return [...grants, newGrant];
}

/**
 * Returns a new collection with the matching grant removed.
 * No-op when no matching grant exists — the desired state (grant absent) is already met.
 */
export function revokeRole(grants: readonly RoleGrant[], target: RoleGrant): readonly RoleGrant[] {
    return grants.filter((g) => !grantsMatch(g, target));
}

/**
 * Resolution helper for downstream ACL adapters.
 * Returns `true` when `grants` contains an entry for `userId` with the given role and scope.
 *
 * Note: The Exhibitor capability is NOT a role grant. Any Active User is implicitly
 * an Exhibitor; ACL adapters check `user.status === 'Active'` instead of `hasRole`.
 */
export function hasRole(
    grants: readonly RoleGrant[],
    userId: UserId,
    grantKey: RoleGrantKey,
): boolean {
    return grants.some((g) => grantsMatch(g, { userId, ...grantKey } as RoleGrant));
}

/**
 * Reusable domain-level check for the `RoleGrantRepository.saveAll` owner-mismatch
 * invariant. Throws {@link RoleGrantOwnerMismatchError} when any grant in
 * `grants` belongs to a user other than `userId`.
 *
 * This is the shared, repository-agnostic way to honour the `saveAll`
 * "throws on owner mismatch" contract, so adapters reuse one check instead of
 * re-implementing it. The interface cannot force the call and the domain suite
 * cannot detect an adapter that omits it — each `saveAll` implementation
 * remains responsible for invoking this (or an equivalent) check to satisfy
 * the contract.
 *
 * The pure {@link grantRole} / {@link revokeRole} / {@link hasRole}
 * helpers already operate on `readonly RoleGrant[]` and are unchanged — this
 * function owns only the cross-grant "all grants share one owner" rule that
 * `saveAll`'s replace-all semantics rely on.
 */
export function assertGrantsOwnedBy(userId: UserId, grants: readonly RoleGrant[]): void {
    for (const grant of grants) {
        if (grant.userId !== userId) throw new RoleGrantOwnerMismatchError(userId, grant);
    }
}
