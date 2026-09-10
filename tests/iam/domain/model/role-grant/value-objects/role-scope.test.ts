// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { asClubId } from '../../../../../../src/Shared/index.js';
import {
    ClubScope,
    PlatformScope,
    roleScopesEqual,
} from '../../../../../../src/iam/domain/model/role-grant/value-objects/role-scope.js';

const CLUB_A = asClubId('club-a');
const CLUB_B = asClubId('club-b');

describe('RoleScope variant equality', () => {
    it('ClubScope.equals is true for the same clubId', () => {
        expect(ClubScope.of(CLUB_A).equals(ClubScope.of(CLUB_A))).toBe(true);
    });

    it('ClubScope.equals is false for differing clubIds', () => {
        expect(ClubScope.of(CLUB_A).equals(ClubScope.of(CLUB_B))).toBe(false);
    });

    it('PlatformScope.equals is true for any two platform scopes (data-less)', () => {
        expect(PlatformScope.of().equals(PlatformScope.of())).toBe(true);
    });
});

describe('roleScopesEqual', () => {
    it('equals two Club scopes with the same clubId', () => {
        expect(roleScopesEqual(ClubScope.of(CLUB_A), ClubScope.of(CLUB_A))).toBe(true);
    });

    it('does not equal two Club scopes with differing clubIds', () => {
        expect(roleScopesEqual(ClubScope.of(CLUB_A), ClubScope.of(CLUB_B))).toBe(false);
    });

    it('equals any two Platform scopes (data-less)', () => {
        expect(roleScopesEqual(PlatformScope.of(), PlatformScope.of())).toBe(true);
    });

    it('does not equal a Club scope and a Platform scope (either direction)', () => {
        expect(roleScopesEqual(ClubScope.of(CLUB_A), PlatformScope.of())).toBe(false);
        expect(roleScopesEqual(PlatformScope.of(), ClubScope.of(CLUB_A))).toBe(false);
    });
});
