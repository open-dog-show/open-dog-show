// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId } from '../../../../../src/Shared/index.js';
import { RoleScope } from '../../../../../src/iam/domain/model/role-grant/value-objects/role-scope.js';
import {
    RoleGrant,
    InvalidRoleScopeError,
    type DomainRole,
} from '../../../../../src/iam/domain/model/role-grant/role-grant.js';

const CLUB_A = asClubId('club-a');
const CLUB_B = asClubId('club-b');

const clubAScope = RoleScope.club(CLUB_A);
const platformScope = RoleScope.platform();

// ---------------------------------------------------------------------------
// RoleGrant construction (factories + rehydrate invariant)
// ---------------------------------------------------------------------------

describe('RoleGrant construction', () => {
    it('showSecretary pairs ShowSecretary with a ClubScope carrying the clubId', () => {
        const g = RoleGrant.showSecretary(CLUB_A);
        expect(g.role).toBe('ShowSecretary');
        expect(g.scope).toStrictEqual(clubAScope);
    });

    it('judge / platformAdministrator pair with a PlatformScope', () => {
        expect(RoleGrant.judge().scope).toStrictEqual(platformScope);
        expect(RoleGrant.platformAdministrator().scope).toStrictEqual(platformScope);
    });

    it('rehydrate accepts a valid role↔scope pair', () => {
        const g = RoleGrant.rehydrate('ShowSecretary', clubAScope);
        expect(g.role).toBe('ShowSecretary');
        expect(g.scope).toStrictEqual(clubAScope);
    });

    it('rehydrate rejects every wrong role↔scope pairing (runtime guard)', () => {
        expect(() => RoleGrant.rehydrate('ShowSecretary', platformScope)).toThrow(
            InvalidRoleScopeError,
        );
        expect(() => RoleGrant.rehydrate('Judge', clubAScope)).toThrow(InvalidRoleScopeError);
        expect(() => RoleGrant.rehydrate('PlatformAdministrator', clubAScope)).toThrow(
            InvalidRoleScopeError,
        );
    });

    it('InvalidRoleScopeError carries the offending role, scope kind, and clubId', () => {
        let caught: unknown;
        try {
            RoleGrant.rehydrate('Judge', clubAScope);
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
        // { role, scope } is not assignable to the class (mirrors LocalDate).
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAGrant: RoleGrant = {
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
        expect(() => RoleGrant.rehydrate('ShowSecretary', malformedClub)).toThrow(
            InvalidRoleScopeError,
        );
    });

    it('rehydrate rejects a platform scope carrying a clubId (runtime guard)', () => {
        const malformedPlatform = { kind: 'platform', clubId: CLUB_A } as unknown as RoleScope;
        expect(() => RoleGrant.rehydrate('Judge', malformedPlatform)).toThrow(
            InvalidRoleScopeError,
        );
    });
});

// ---------------------------------------------------------------------------
// RoleGrant.prototype.equals
// ---------------------------------------------------------------------------

describe('RoleGrant.prototype.equals', () => {
    it('is true for the same role and an equal scope', () => {
        expect(RoleGrant.showSecretary(CLUB_A).equals(RoleGrant.showSecretary(CLUB_A))).toBe(true);
        expect(RoleGrant.judge().equals(RoleGrant.judge())).toBe(true);
    });

    it('is false for the same role in different Club scopes', () => {
        expect(RoleGrant.showSecretary(CLUB_A).equals(RoleGrant.showSecretary(CLUB_B))).toBe(false);
    });

    it('is false for different roles even at the same scope kind', () => {
        expect(RoleGrant.judge().equals(RoleGrant.platformAdministrator())).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Exhibitor boundary
// ---------------------------------------------------------------------------

describe('Exhibitor boundary', () => {
    /**
     * The Exhibitor capability is NOT a RoleGrant.
     * Any Active User implicitly holds Exhibitor rights; ACL adapters check
     * `user.isActive()` — not a RoleGrant entry. The DomainRole union
     * therefore does not include 'Exhibitor'.
     */
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
