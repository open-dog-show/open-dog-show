// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TenantId, UserId } from '@ods/kernel';

export type DomainRole = 'ShowSecretary' | 'Judge' | 'PlatformAdministrator';

export type RoleScope =
    { readonly kind: 'tenant'; readonly tenantId: TenantId } | { readonly kind: 'platform' };

export interface RoleGrant {
    readonly userId: UserId;
    readonly role: DomainRole;
    readonly scope: RoleScope;
}

export class DuplicateRoleGrantError extends Error {
    readonly grant: RoleGrant;

    constructor(grant: RoleGrant) {
        super(`User ${grant.userId} already holds role ${grant.role} in the given scope`);
        this.name = 'DuplicateRoleGrantError';
        this.grant = grant;
    }
}

function scopesEqual(a: RoleScope, b: RoleScope): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'tenant' && b.kind === 'tenant') return a.tenantId === b.tenantId;
    return true;
}

function grantsMatch(a: RoleGrant, b: Pick<RoleGrant, 'userId' | 'role' | 'scope'>): boolean {
    return a.userId === b.userId && a.role === b.role && scopesEqual(a.scope, b.scope);
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
export function revokeRoleGrant(
    grants: readonly RoleGrant[],
    target: Pick<RoleGrant, 'userId' | 'role' | 'scope'>,
): readonly RoleGrant[] {
    return grants.filter((g) => !grantsMatch(g, target));
}

/**
 * Resolution helper for downstream ACL adapters.
 * Returns `true` when `grants` contains an entry for `userId` with the given role and scope.
 *
 * Note: The Exhibitor capability is NOT a role grant. Any Active User is implicitly
 * an Exhibitor; ACL adapters check `user.status === 'Active'` instead of `hasRoleGrant`.
 */
export function hasRoleGrant(
    grants: readonly RoleGrant[],
    userId: UserId,
    role: DomainRole,
    scope: RoleScope,
): boolean {
    return grants.some((g) => grantsMatch(g, { userId, role, scope }));
}
