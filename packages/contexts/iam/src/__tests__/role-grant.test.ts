// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asClubId } from '@ods/kernel';
import { asUserId } from '../domain/domain-ids.js';
import type { DomainRole, ClubScope, PlatformScope, RoleGrant } from '../domain/role-grant.js';
import {
    grantRole,
    revokeRoleGrant,
    hasRoleGrant,
    assertGrantsOwnedBy,
    DuplicateRoleGrantError,
    RoleGrantOwnerMismatchError,
} from '../domain/role-grant.js';
import { FakeRoleGrantRepository } from '../testing/index.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');
const CLUB_A = asClubId('club-a');
const CLUB_B = asClubId('club-b');

const clubAScope: ClubScope = { kind: 'club', clubId: CLUB_A };
const clubBScope: ClubScope = { kind: 'club', clubId: CLUB_B };
const platformScope: PlatformScope = { kind: 'platform' };

const aliceShowSecretary: RoleGrant = {
    userId: ALICE_ID,
    role: 'ShowSecretary',
    scope: clubAScope,
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

    it('allows granting the same role to different Clubs (Club-scoped)', () => {
        const aliceShowSecretaryB: RoleGrant = {
            userId: ALICE_ID,
            role: 'ShowSecretary',
            scope: clubBScope,
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

    // ShowSecretary is Club-scoped: a grant is tied to one specific ClubId
    describe('ShowSecretary (Club-scoped)', () => {
        it('returns true for the correct Club', () => {
            expect(
                hasRoleGrant(grants, ALICE_ID, { role: 'ShowSecretary', scope: clubAScope }),
            ).toBe(true);
        });

        it('returns false for a different Club', () => {
            expect(
                hasRoleGrant(grants, ALICE_ID, { role: 'ShowSecretary', scope: clubBScope }),
            ).toBe(false);
        });

        it('returns false when the user does not hold the role', () => {
            expect(hasRoleGrant(grants, BOB_ID, { role: 'ShowSecretary', scope: clubAScope })).toBe(
                false,
            );
        });

        it('type system rejects ShowSecretary at platform scope', () => {
            void ({
                userId: ALICE_ID,
                role: 'ShowSecretary',
                scope: platformScope,
                // @ts-expect-error — ShowSecretary requires ClubScope; PlatformScope is structurally invalid here
            } satisfies RoleGrant);
        });
    });

    // Judge is platform-scoped: no ClubId is involved
    describe('Judge (platform-scoped)', () => {
        it('returns true when granted', () => {
            expect(hasRoleGrant(grants, ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(
                true,
            );
        });

        it('returns false when not granted', () => {
            expect(hasRoleGrant(grants, BOB_ID, { role: 'Judge', scope: platformScope })).toBe(
                false,
            );
        });

        it('type system rejects Judge at Club scope', () => {
            // @ts-expect-error — Judge requires PlatformScope; ClubScope is structurally invalid here
            void ({ userId: ALICE_ID, role: 'Judge', scope: clubAScope } satisfies RoleGrant);
        });
    });

    // PlatformAdministrator is platform-scoped: no ClubId is involved
    describe('PlatformAdministrator (platform-scoped)', () => {
        it('returns true when granted', () => {
            expect(
                hasRoleGrant(grants, BOB_ID, {
                    role: 'PlatformAdministrator',
                    scope: platformScope,
                }),
            ).toBe(true);
        });

        it('returns false when not granted', () => {
            expect(
                hasRoleGrant(grants, ALICE_ID, {
                    role: 'PlatformAdministrator',
                    scope: platformScope,
                }),
            ).toBe(false);
        });

        it('type system rejects PlatformAdministrator at Club scope', () => {
            void ({
                userId: ALICE_ID,
                role: 'PlatformAdministrator',
                scope: clubAScope,
                // @ts-expect-error — PlatformAdministrator requires PlatformScope; ClubScope is structurally invalid here
            } satisfies RoleGrant);
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

        expect(hasRoleGrant(grants, ALICE_ID, { role: 'ShowSecretary', scope: clubAScope })).toBe(
            false,
        );
        expect(hasRoleGrant(grants, ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(false);
        expect(
            hasRoleGrant(grants, ALICE_ID, { role: 'PlatformAdministrator', scope: platformScope }),
        ).toBe(false);
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
// assertGrantsOwnedBy
// ---------------------------------------------------------------------------

describe('assertGrantsOwnedBy', () => {
    /**
     * assertGrantsOwnedBy is a reusable domain-level check for the saveAll
     * owner-mismatch invariant. Each saveAll adapter is responsible for
     * invoking it (or an equivalent check) to honour the contract; the
     * interface cannot force the call, so this suite pins the helper's own
     * behaviour, not any adapter's use of it.
     */
    it('passes for an empty collection', () => {
        expect(() => assertGrantsOwnedBy(ALICE_ID, [])).not.toThrow();
    });

    it('passes for a single-owner collection', () => {
        expect(() => assertGrantsOwnedBy(ALICE_ID, [aliceShowSecretary, aliceJudge])).not.toThrow();
    });

    it('passes for a single-owner collection owned by a different user', () => {
        expect(() => assertGrantsOwnedBy(BOB_ID, [bobPlatformAdmin])).not.toThrow();
    });

    it('throws RoleGrantOwnerMismatchError when a grant belongs to a different user', () => {
        expect(() => assertGrantsOwnedBy(ALICE_ID, [bobPlatformAdmin])).toThrow(
            RoleGrantOwnerMismatchError,
        );
    });

    it('throws when a mixed-owner collection contains a foreign grant', () => {
        expect(() => assertGrantsOwnedBy(ALICE_ID, [aliceShowSecretary, bobPlatformAdmin])).toThrow(
            RoleGrantOwnerMismatchError,
        );
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
