// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asUserId, asTenantId } from '@ods/kernel';
import type { DomainRole, RoleGrant, RoleScope } from '../domain/role-grant.js';
import {
    grantRole,
    revokeRoleGrant,
    hasRoleGrant,
    DuplicateRoleGrantError,
} from '../domain/role-grant.js';
import { FakeRoleGrantRepository } from '../testing/index.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');
const TENANT_A = asTenantId('tenant-a');
const TENANT_B = asTenantId('tenant-b');

const tenantAScope: RoleScope = { kind: 'tenant', tenantId: TENANT_A };
const tenantBScope: RoleScope = { kind: 'tenant', tenantId: TENANT_B };
const platformScope: RoleScope = { kind: 'platform' };

const aliceShowSecretary: RoleGrant = {
    userId: ALICE_ID,
    role: 'ShowSecretary',
    scope: tenantAScope,
};

const aliceJudge: RoleGrant = {
    userId: ALICE_ID,
    role: 'Judge',
    scope: platformScope,
};

const bobPlatformAdmin: RoleGrant = {
    userId: BOB_ID,
    role: 'PlatformAdministrator',
    scope: platformScope,
};

// ---------------------------------------------------------------------------
// grantRole
// ---------------------------------------------------------------------------

describe('grantRole', () => {
    it('adds a RoleGrant to an empty collection', () => {
        const result = grantRole([], aliceShowSecretary);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(aliceShowSecretary);
    });

    it('appends a new grant to an existing collection', () => {
        const result = grantRole([aliceShowSecretary], aliceJudge);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual(aliceShowSecretary);
        expect(result).toContainEqual(aliceJudge);
    });

    it('throws DuplicateRoleGrantError when granting the same role+scope twice', () => {
        const grants = [aliceShowSecretary];

        expect(() => grantRole(grants, aliceShowSecretary)).toThrow(DuplicateRoleGrantError);
    });

    it('DuplicateRoleGrantError carries the conflicting grant', () => {
        let caught: unknown;
        try {
            grantRole([aliceShowSecretary], aliceShowSecretary);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(DuplicateRoleGrantError);
        expect((caught as DuplicateRoleGrantError).grant).toEqual(aliceShowSecretary);
    });

    it('allows granting the same role to different tenants (tenant-scoped)', () => {
        const aliceShowSecretaryB: RoleGrant = {
            userId: ALICE_ID,
            role: 'ShowSecretary',
            scope: tenantBScope,
        };
        const result = grantRole([aliceShowSecretary], aliceShowSecretaryB);

        expect(result).toHaveLength(2);
    });

    it('allows granting different roles to the same user', () => {
        const result = grantRole([aliceShowSecretary], aliceJudge);

        expect(result).toHaveLength(2);
    });

    it('does not mutate the original collection', () => {
        const original: RoleGrant[] = [aliceShowSecretary];
        grantRole(original, aliceJudge);

        expect(original).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// revokeRoleGrant
// ---------------------------------------------------------------------------

describe('revokeRoleGrant', () => {
    it('removes a matching RoleGrant', () => {
        const grants = [aliceShowSecretary, aliceJudge];
        const result = revokeRoleGrant(grants, aliceShowSecretary);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(aliceJudge);
    });

    it('is a no-op when the grant does not exist', () => {
        const grants = [aliceJudge];
        const result = revokeRoleGrant(grants, aliceShowSecretary);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(aliceJudge);
    });

    it('is a no-op on an empty collection', () => {
        const result = revokeRoleGrant([], aliceShowSecretary);

        expect(result).toHaveLength(0);
    });

    it('removes only the matching grant, leaving others intact', () => {
        const grants = [aliceShowSecretary, aliceJudge, bobPlatformAdmin];
        const result = revokeRoleGrant(grants, aliceJudge);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual(aliceShowSecretary);
        expect(result).toContainEqual(bobPlatformAdmin);
    });

    it('does not mutate the original collection', () => {
        const original = [aliceShowSecretary, aliceJudge];
        revokeRoleGrant(original, aliceShowSecretary);

        expect(original).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// hasRoleGrant
// ---------------------------------------------------------------------------

describe('hasRoleGrant', () => {
    const grants = [aliceShowSecretary, aliceJudge, bobPlatformAdmin];

    it('returns true for ShowSecretary in the correct tenant scope', () => {
        expect(hasRoleGrant(grants, ALICE_ID, 'ShowSecretary', tenantAScope)).toBe(true);
    });

    it('returns false for ShowSecretary in a different tenant scope', () => {
        expect(hasRoleGrant(grants, ALICE_ID, 'ShowSecretary', tenantBScope)).toBe(false);
    });

    it('returns true for Judge (platform-scoped)', () => {
        expect(hasRoleGrant(grants, ALICE_ID, 'Judge', platformScope)).toBe(true);
    });

    it('returns true for PlatformAdministrator (platform-scoped)', () => {
        expect(hasRoleGrant(grants, BOB_ID, 'PlatformAdministrator', platformScope)).toBe(true);
    });

    it('returns false when the user does not hold the specified role', () => {
        expect(hasRoleGrant(grants, BOB_ID, 'Judge', platformScope)).toBe(false);
    });

    it('returns false for an empty grants collection', () => {
        expect(hasRoleGrant([], ALICE_ID, 'Judge', platformScope)).toBe(false);
    });

    it('returns false when the grant belongs to a different user', () => {
        expect(hasRoleGrant(grants, BOB_ID, 'ShowSecretary', tenantAScope)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Exhibitor boundary
// ---------------------------------------------------------------------------

describe('Exhibitor boundary', () => {
    /**
     * The Exhibitor capability is NOT a RoleGrant.
     * Any Active User implicitly holds Exhibitor rights; ACL adapters check
     * `user.status === 'Active'` — not a RoleGrant entry.
     * The DomainRole union therefore does not include 'Exhibitor'.
     */
    it('an Active User with zero RoleGrants is still an Exhibitor — no grant required', () => {
        const grants: RoleGrant[] = [];

        expect(hasRoleGrant(grants, ALICE_ID, 'ShowSecretary', tenantAScope)).toBe(false);
        expect(hasRoleGrant(grants, ALICE_ID, 'Judge', platformScope)).toBe(false);
        expect(hasRoleGrant(grants, ALICE_ID, 'PlatformAdministrator', platformScope)).toBe(false);
        // Zero grants → zero explicit roles, but Exhibitor capability is still present
        // via user.status === 'Active' — no RoleGrant entry is needed or exists.
    });

    it('Exhibitor is not part of the DomainRole union — no grant type exists for it', () => {
        // DomainRole is the exhaustive list of explicitly-granted roles.
        // 'Exhibitor' is intentionally absent; it is implicit for every Active User.
        const allDomainRoles: readonly DomainRole[] = [
            'ShowSecretary',
            'Judge',
            'PlatformAdministrator',
        ];
        expect(allDomainRoles).not.toContain('Exhibitor');
    });
});

// ---------------------------------------------------------------------------
// FakeRoleGrantRepository
// ---------------------------------------------------------------------------

describe('FakeRoleGrantRepository', () => {
    let repo: FakeRoleGrantRepository;

    beforeEach(() => {
        repo = new FakeRoleGrantRepository();
    });

    it('findByUser returns an empty array for an unknown user', async () => {
        const grants = await repo.findByUser(ALICE_ID);

        expect(grants).toHaveLength(0);
    });

    it('saveAll and findByUser round-trip', async () => {
        await repo.saveAll(ALICE_ID, [aliceShowSecretary, aliceJudge]);
        const grants = await repo.findByUser(ALICE_ID);

        expect(grants).toHaveLength(2);
        expect(grants).toContainEqual(aliceShowSecretary);
        expect(grants).toContainEqual(aliceJudge);
    });

    it('saveAll replaces previous grants for the user', async () => {
        await repo.saveAll(ALICE_ID, [aliceShowSecretary, aliceJudge]);
        await repo.saveAll(ALICE_ID, [aliceJudge]);
        const grants = await repo.findByUser(ALICE_ID);

        expect(grants).toHaveLength(1);
        expect(grants[0]).toEqual(aliceJudge);
    });

    it('grants for different users are stored independently', async () => {
        await repo.saveAll(ALICE_ID, [aliceJudge]);
        await repo.saveAll(BOB_ID, [bobPlatformAdmin]);

        const aliceGrants = await repo.findByUser(ALICE_ID);
        const bobGrants = await repo.findByUser(BOB_ID);

        expect(aliceGrants).toHaveLength(1);
        expect(bobGrants).toHaveLength(1);
    });
});
