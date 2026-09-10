// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { asClubId } from '../../../../../../src/Shared/index.js';
import { RoleScope } from '../../../../../../src/iam/domain/model/role-grant/value-objects/role-scope.js';

const CLUB_A = asClubId('club-a');
const CLUB_B = asClubId('club-b');

describe('RoleScope', () => {
    it('club() sets kind=club and the clubId', () => {
        const s = RoleScope.club(CLUB_A);
        expect(s.kind).toBe('club');
        expect(s.clubId).toBe(CLUB_A);
    });

    it('platform() sets kind=platform and no clubId', () => {
        const s = RoleScope.platform();
        expect(s.kind).toBe('platform');
        expect(s.clubId).toBeUndefined();
    });

    it('equals is true for two club scopes with the same clubId', () => {
        expect(RoleScope.club(CLUB_A).equals(RoleScope.club(CLUB_A))).toBe(true);
    });

    it('equals is false for two club scopes with differing clubIds', () => {
        expect(RoleScope.club(CLUB_A).equals(RoleScope.club(CLUB_B))).toBe(false);
    });

    it('equals is true for any two platform scopes', () => {
        expect(RoleScope.platform().equals(RoleScope.platform())).toBe(true);
    });

    it('equals is false for a club scope and a platform scope (either direction)', () => {
        expect(RoleScope.club(CLUB_A).equals(RoleScope.platform())).toBe(false);
        expect(RoleScope.platform().equals(RoleScope.club(CLUB_A))).toBe(false);
    });
});
