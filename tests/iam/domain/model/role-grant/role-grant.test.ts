// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asClubId } from '../../../../../src/Shared/index.js';
import { asUserId } from '../../../../../src/iam/domain/shared/domain-ids.js';
import { RoleScope } from '../../../../../src/iam/domain/model/role-grant/value-objects/role-scope.js';
import type { DomainRole } from '../../../../../src/iam/domain/model/role-grant/role-grant.js';
import {
    RoleGrant,
    InvalidRoleScopeError,
    DuplicateRoleGrantError,
    RoleGrantOwnerMismatchError,
} from '../../../../../src/iam/domain/model/role-grant/role-grant.js';
import { FakeRoleGrantRepository } from '../../../../../src/iam/infrastructure/persistence/inmemory/index.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');
const CLUB_A = asClubId('club-a');
const CLUB_B = asClubId('club-b');

const clubAScope = RoleScope.club(CLUB_A);
const clubBScope = RoleScope.club(CLUB_B);
const platformScope = RoleScope.platform();

const aliceShowSecretary = RoleGrant.showSecretary(ALICE_ID, CLUB_A);
const aliceJudge = RoleGrant.judge(ALICE_ID);
const bobPlatformAdmin = RoleGrant.platformAdministrator(BOB_ID);

// ---------------------------------------------------------------------------
// RoleGrant construction (factories + rehydrate invariant)
// ---------------------------------------------------------------------------

describe('RoleGrant construction', () => {
    it('showSecretary pairs ShowSecretary with a ClubScope carrying the clubId', () => {
        const g = RoleGrant.showSecretary(ALICE_ID, CLUB_A);
        expect(g.userId).toBe(ALICE_ID);
        expect(g.role).toBe('ShowSecretary');
        expect(g.scope).toStrictEqual(clubAScope);
    });

    it('judge / platformAdministrator pair with a PlatformScope', () => {
        expect(RoleGrant.judge(ALICE_ID).scope).toStrictEqual(platformScope);
        expect(RoleGrant.platformAdministrator(BOB_ID).scope).toStrictEqual(platformScope);
    });

    it('rehydrate accepts a valid role↔scope pair', () => {
        const g = RoleGrant.rehydrate(ALICE_ID, 'ShowSecretary', clubAScope);
        expect(g.role).toBe('ShowSecretary');
        expect(g.scope).toStrictEqual(clubAScope);
    });

    it('rehydrate rejects every wrong role↔scope pairing (runtime guard)', () => {
        expect(() => RoleGrant.rehydrate(ALICE_ID, 'ShowSecretary', platformScope)).toThrow(
            InvalidRoleScopeError,
        );
        expect(() => RoleGrant.rehydrate(ALICE_ID, 'Judge', clubAScope)).toThrow(
            InvalidRoleScopeError,
        );
        expect(() => RoleGrant.rehydrate(ALICE_ID, 'PlatformAdministrator', clubAScope)).toThrow(
            InvalidRoleScopeError,
        );
    });

    it('InvalidRoleScopeError carries the offending role, scope kind, and clubId', () => {
        let caught: unknown;
        try {
            RoleGrant.rehydrate(ALICE_ID, 'Judge', clubAScope);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(InvalidRoleScopeError);
        expect((caught as InvalidRoleScopeError).role).toBe('Judge');
        expect((caught as InvalidRoleScopeError).scopeKind).toBe('club');
        // clubAScope carries CLUB_A — the error surfaces the extra clubId on a
        // platform role so the failure is diagnosable.
        expect((caught as InvalidRoleScopeError).clubId).toBe(CLUB_A);
    });

    it('is nominal — a structural object literal is not assignable to RoleGrant', () => {
        // The private #brand field closes the structural-literal leak: a bare
        // { userId, role, scope } is not assignable to the class (mirrors LocalDate).
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAGrant: RoleGrant = {
            userId: ALICE_ID,
            role: 'Judge' as const,
            scope: platformScope,
        };
        expect(notAGrant).toBeDefined();
    });

    it('rehydrate rejects a club scope missing its clubId (runtime guard)', () => {
        // The type system cannot express a malformed RoleScope (its `equals`
        // method blocks structural literals), so simulate a corrupt storage
        // value: a club scope carrying no clubId. rehydrate must reject it.
        const malformedClub = { kind: 'club', clubId: undefined } as unknown as RoleScope;
        expect(() => RoleGrant.rehydrate(ALICE_ID, 'ShowSecretary', malformedClub)).toThrow(
            InvalidRoleScopeError,
        );
    });

    it('rehydrate rejects a platform scope carrying a clubId (runtime guard)', () => {
        const malformedPlatform = { kind: 'platform', clubId: CLUB_A } as unknown as RoleScope;
        expect(() => RoleGrant.rehydrate(ALICE_ID, 'Judge', malformedPlatform)).toThrow(
            InvalidRoleScopeError,
        );
    });
});

// ---------------------------------------------------------------------------
// RoleGrant.grant
// ---------------------------------------------------------------------------

describe('RoleGrant.grant', () => {
    it('adds a RoleGrant to an empty collection', () => {
        const result = RoleGrant.grant([], aliceShowSecretary);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(aliceShowSecretary);
    });

    it('appends a new grant to an existing collection', () => {
        const result = RoleGrant.grant([aliceShowSecretary], aliceJudge);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual(aliceShowSecretary);
        expect(result).toContainEqual(aliceJudge);
    });

    it('throws DuplicateRoleGrantError when granting the same role+scope twice', () => {
        const grants = [aliceShowSecretary];

        expect(() => RoleGrant.grant(grants, aliceShowSecretary)).toThrow(DuplicateRoleGrantError);
    });

    it('DuplicateRoleGrantError carries the conflicting grant', () => {
        let caught: unknown;
        try {
            RoleGrant.grant([aliceShowSecretary], aliceShowSecretary);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(DuplicateRoleGrantError);
        expect((caught as DuplicateRoleGrantError).grant).toEqual(aliceShowSecretary);
    });

    it('allows granting the same role to different Clubs (Club-scoped)', () => {
        const aliceShowSecretaryB = RoleGrant.showSecretary(ALICE_ID, CLUB_B);
        const result = RoleGrant.grant([aliceShowSecretary], aliceShowSecretaryB);

        expect(result).toHaveLength(2);
    });

    it('allows granting different roles to the same user', () => {
        const result = RoleGrant.grant([aliceShowSecretary], aliceJudge);

        expect(result).toHaveLength(2);
    });

    it('does not mutate the original collection', () => {
        const original: RoleGrant[] = [aliceShowSecretary];
        RoleGrant.grant(original, aliceJudge);

        expect(original).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// RoleGrant.revoke
// ---------------------------------------------------------------------------

describe('RoleGrant.revoke', () => {
    it('removes a matching RoleGrant', () => {
        const grants = [aliceShowSecretary, aliceJudge];
        const result = RoleGrant.revoke(grants, aliceShowSecretary);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(aliceJudge);
    });

    it('is a no-op when the grant does not exist', () => {
        const grants = [aliceJudge];
        const result = RoleGrant.revoke(grants, aliceShowSecretary);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(aliceJudge);
    });

    it('is a no-op on an empty collection', () => {
        const result = RoleGrant.revoke([], aliceShowSecretary);

        expect(result).toHaveLength(0);
    });

    it('removes only the matching grant, leaving others intact', () => {
        const grants = [aliceShowSecretary, aliceJudge, bobPlatformAdmin];
        const result = RoleGrant.revoke(grants, aliceJudge);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual(aliceShowSecretary);
        expect(result).toContainEqual(bobPlatformAdmin);
    });

    it('does not mutate the original collection', () => {
        const original = [aliceShowSecretary, aliceJudge];
        RoleGrant.revoke(original, aliceShowSecretary);

        expect(original).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// RoleGrant.has
// ---------------------------------------------------------------------------

describe('RoleGrant.has', () => {
    const grants = [aliceShowSecretary, aliceJudge, bobPlatformAdmin];

    // ShowSecretary is Club-scoped: a grant is tied to one specific ClubId
    describe('ShowSecretary (Club-scoped)', () => {
        it('returns true for the correct Club', () => {
            expect(
                RoleGrant.has(grants, ALICE_ID, { role: 'ShowSecretary', scope: clubAScope }),
            ).toBe(true);
        });

        it('returns false for a different Club', () => {
            expect(
                RoleGrant.has(grants, ALICE_ID, { role: 'ShowSecretary', scope: clubBScope }),
            ).toBe(false);
        });

        it('returns false when the user does not hold the role', () => {
            expect(
                RoleGrant.has(grants, BOB_ID, { role: 'ShowSecretary', scope: clubAScope }),
            ).toBe(false);
        });

        it('rejects ShowSecretary at platform scope at construction (runtime guard)', () => {
            expect(() => RoleGrant.rehydrate(ALICE_ID, 'ShowSecretary', platformScope)).toThrow(
                InvalidRoleScopeError,
            );
        });
    });

    // Judge is platform-scoped: no ClubId is involved
    describe('Judge (platform-scoped)', () => {
        it('returns true when granted', () => {
            expect(RoleGrant.has(grants, ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(
                true,
            );
        });

        it('returns false when not granted', () => {
            expect(RoleGrant.has(grants, BOB_ID, { role: 'Judge', scope: platformScope })).toBe(
                false,
            );
        });

        it('rejects Judge at Club scope at construction (runtime guard)', () => {
            expect(() => RoleGrant.rehydrate(ALICE_ID, 'Judge', clubAScope)).toThrow(
                InvalidRoleScopeError,
            );
        });
    });

    // PlatformAdministrator is platform-scoped: no ClubId is involved
    describe('PlatformAdministrator (platform-scoped)', () => {
        it('returns true when granted', () => {
            expect(
                RoleGrant.has(grants, BOB_ID, {
                    role: 'PlatformAdministrator',
                    scope: platformScope,
                }),
            ).toBe(true);
        });

        it('returns false when not granted', () => {
            expect(
                RoleGrant.has(grants, ALICE_ID, {
                    role: 'PlatformAdministrator',
                    scope: platformScope,
                }),
            ).toBe(false);
        });

        it('rejects PlatformAdministrator at Club scope at construction (runtime guard)', () => {
            expect(() =>
                RoleGrant.rehydrate(ALICE_ID, 'PlatformAdministrator', clubAScope),
            ).toThrow(InvalidRoleScopeError);
        });
    });

    it('returns false for an empty grants collection', () => {
        expect(RoleGrant.has([], ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(false);
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

        expect(RoleGrant.has(grants, ALICE_ID, { role: 'ShowSecretary', scope: clubAScope })).toBe(
            false,
        );
        expect(RoleGrant.has(grants, ALICE_ID, { role: 'Judge', scope: platformScope })).toBe(
            false,
        );
        expect(
            RoleGrant.has(grants, ALICE_ID, {
                role: 'PlatformAdministrator',
                scope: platformScope,
            }),
        ).toBe(false);
        // Zero grants → zero explicit roles, but Exhibitor capability is still present
        // via user.status === 'Active' — no RoleGrant entry is needed or exists.
    });

    it('Exhibitor is not part of the DomainRole union — no grant type exists for it', () => {
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
// RoleGrant.assertOwnedBy
// ---------------------------------------------------------------------------

describe('RoleGrant.assertOwnedBy', () => {
    /**
     * RoleGrant.assertOwnedBy is a reusable domain-level check for the saveAll
     * owner-mismatch invariant. Each saveAll adapter is responsible for
     * invoking it (or an equivalent check) to honour the contract; the
     * interface cannot force the call, so this suite pins the helper's own
     * behaviour, not any adapter's use of it.
     */
    it('passes for an empty collection', () => {
        expect(() => RoleGrant.assertOwnedBy(ALICE_ID, [])).not.toThrow();
    });

    it('passes for a single-owner collection', () => {
        expect(() =>
            RoleGrant.assertOwnedBy(ALICE_ID, [aliceShowSecretary, aliceJudge]),
        ).not.toThrow();
    });

    it('passes for a single-owner collection owned by a different user', () => {
        expect(() => RoleGrant.assertOwnedBy(BOB_ID, [bobPlatformAdmin])).not.toThrow();
    });

    it('throws RoleGrantOwnerMismatchError when a grant belongs to a different user', () => {
        expect(() => RoleGrant.assertOwnedBy(ALICE_ID, [bobPlatformAdmin])).toThrow(
            RoleGrantOwnerMismatchError,
        );
    });

    it('throws when a mixed-owner collection contains a foreign grant', () => {
        expect(() =>
            RoleGrant.assertOwnedBy(ALICE_ID, [aliceShowSecretary, bobPlatformAdmin]),
        ).toThrow(RoleGrantOwnerMismatchError);
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
