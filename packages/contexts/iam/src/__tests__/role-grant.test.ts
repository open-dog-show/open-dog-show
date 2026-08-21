// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asUserId, asTenantId } from '@ods/kernel';
import type { DomainRole, TenantScope, PlatformScope, RoleGrant } from '../domain/role-grant.js';
import {
    grantRole,
    revokeRoleGrant,
    hasRoleGrant,
    DuplicateRoleGrantError,
    RoleGrantOwnerMismatchError,
} from '../domain/role-grant.js';
import { FakeRoleGrantRepository } from '../testing/index.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');
const TENANT_A = asTenantId('tenant-a');
const TENANT_B = asTenantId('tenant-b');

const tenantAScope: TenantScope = { kind: 'tenant', tenantId: TENANT_A };
const tenantBScope: TenantScope = { kind: 'tenant', tenantId: TENANT_B };
const platformScope: PlatformScope = { kind: 'platform' };

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

    // ShowSecretary is tenant-scoped: a grant is tied to one specific TenantId
    describe('ShowSecretary (tenant-scoped)', () => {
        it('returns true for the correct tenant', () => {
            expect(hasRoleGrant(grants, ALICE_ID, { role: 'ShowSecretary', scope: tenantAScope })).toBe(true);
        });

        it('returns false for a different tenant', () => {
            expect(hasRoleGrant(grants, ALICE_ID, { role: 'ShowSecretary', scope: tenantBScope })).toBe(false);
        });

        it('returns false when the user does not hold the role', () => {
            expect(hasRoleGrant(grants, BOB_ID, { role: 'ShowSecretary', scope: tenantAScope })).toBe(false);
        });

        it('type system rejects ShowSecretary at platform scope', () => {
            // @ts-expect-error â€” ShowSecretary requires TenantScope; PlatformScope is structurally invalid here
            const _: RoleGrant = { userId: ALICE_ID, role: 'ShowSecretary', scope: platformScope };
        });
    });

    // Judge is platform-scoped: no TenantId is involved
    describe('Judge (platform-scoped)', () => {
        it('returns true when granted', () => {
            expect(hasRoleGrant(grants, ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(true);
        });

        it('returns false when not granted', () => {
            expect(hasRoleGrant(grants, BOB_ID, { role: 'Judge', scope: platformScope })).toBe(false);
        });

        it('type system rejects Judge at tenant scope', () => {
            // @ts-expect-error â€” Judge requires PlatformScope; TenantScope is structurally invalid here
            const _: RoleGrant = { userId: ALICE_ID, role: 'Judge', scope: tenantAScope };
        });
    });

    // PlatformAdministrator is platform-scoped: no TenantId is involved
    describe('PlatformAdministrator (platform-scoped)', () => {
        it('returns true when granted', () => {
            expect(hasRoleGrant(grants, BOB_ID, { role: 'PlatformAdministrator', scope: platformScope })).toBe(true);
        });

        it('returns false when not granted', () => {
            expect(hasRoleGrant(grants, ALICE_ID, { role: 'PlatformAdministrator', scope: platformScope })).toBe(false);
        });

        it('type system rejects PlatformAdministrator at tenant scope', () => {
            // @ts-expect-error â€” PlatformAdministrator requires PlatformScope; TenantScope is structurally invalid here
            const _: RoleGrant = { userId: ALICE_ID, role: 'PlatformAdministrator', scope: tenantAScope };
        });
    });

    it('returns false for an empty grants collection', () => {
        expect(hasRoleGrant([], ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Exhibitor boundary
// ---------------------------------------------------------------------------

describe('Exhibitor boundary', () => {
    /**
     * The Exhibitor capability is NOT a RoleGrant.
     * Any Active User implicitly holds Exhibitor rights; ACL adapters check
     * `user.status === 'Active'` â€” not a RoleGrant entry.
     * The DomainRole union therefore does not include 'Exhibitor'.
     */
    it('an Active User with zero RoleGrants is still an Exhibitor â€” no grant required', () => {
        const grants: RoleGrant[] = [];

        expect(hasRoleGrant(grants, ALICE_ID, { role: 'ShowSecretary', scope: tenantAScope })).toBe(false);
        expect(hasRoleGrant(grants, ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(false);
        expect(hasRoleGrant(grants, ALICE_ID, { role: 'PlatformAdministrator', scope: platformScope })).toBe(false);
        // Zero grants â†’ zero explicit roles, but Exhibitor capability is still present
        // via user.status === 'Active' â€” no RoleGrant entry is needed or exists.
    });

    it('Exhibitor is not part of the DomainRole union â€” no grant type exists for it', () => {
        // satisfies Record<DomainRole, true> makes this fixture exhaustive:
        // if 'Exhibitor' is ever added to DomainRole, tsc errors here before the test can lie.
        const _allDomainRoles = {
            ShowSecretary: true,
            Judge: true,
            PlatformAdministrator: true,
        } satisfies Record<DomainRole, true>;

        expect(Object.keys(_allDomainRoles)).not.toContain('Exhibitor');
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

    it('saveAll throws RoleGrantOwnerMismatchError when a grant belongs to a different user', async () => {
        await expect(repo.saveAll(ALICE_ID, [bobPlatformAdmin])).rejects.toBeInstanceOf(
            RoleGrantOwnerMismatchError,
        );
    });
});
