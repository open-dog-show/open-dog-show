// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asClubId,
    asEventScope,
    asPrincipalId,
    ClubEventScope,
    ExhibitorEventScope,
    eventScopesEqual,
    PlatformEventScope,
} from '../../../src/Shared/index.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_ID_B = asClubId('00000000-0000-4000-8000-000000000002');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const PRINCIPAL_ID_B = asPrincipalId('00000000-0000-4000-8000-000000000012');

describe('EventScope factories', () => {
    it('club(clubId) / exhibitor(principalId) / platform() fix the kind tag and carry the owner id', () => {
        expect(ClubEventScope.of(CLUB_ID).kind).toBe('club');
        expect(ClubEventScope.of(CLUB_ID).clubId).toBe(CLUB_ID);
        expect(ExhibitorEventScope.of(PRINCIPAL_ID).kind).toBe('exhibitor');
        expect(ExhibitorEventScope.of(PRINCIPAL_ID).principalId).toBe(PRINCIPAL_ID);
        expect(PlatformEventScope.of().kind).toBe('platform');
    });
});

describe('variant equals', () => {
    it('ClubEventScope.equals is true for the same clubId', () => {
        expect(ClubEventScope.of(CLUB_ID).equals(ClubEventScope.of(CLUB_ID))).toBe(true);
    });

    it('ClubEventScope.equals is false when the clubId differs', () => {
        expect(ClubEventScope.of(CLUB_ID).equals(ClubEventScope.of(CLUB_ID_B))).toBe(false);
    });

    it('ExhibitorEventScope.equals is true for the same principalId', () => {
        expect(
            ExhibitorEventScope.of(PRINCIPAL_ID).equals(ExhibitorEventScope.of(PRINCIPAL_ID)),
        ).toBe(true);
    });

    it('ExhibitorEventScope.equals is false when the principalId differs', () => {
        expect(
            ExhibitorEventScope.of(PRINCIPAL_ID).equals(ExhibitorEventScope.of(PRINCIPAL_ID_B)),
        ).toBe(false);
    });

    it('PlatformEventScope.equals is true for any two platform scopes (data-less)', () => {
        expect(PlatformEventScope.of().equals(PlatformEventScope.of())).toBe(true);
    });
});

describe('eventScopesEqual', () => {
    it('equals two scopes of the same kind and data', () => {
        expect(eventScopesEqual(ClubEventScope.of(CLUB_ID), ClubEventScope.of(CLUB_ID))).toBe(true);
        expect(
            eventScopesEqual(
                ExhibitorEventScope.of(PRINCIPAL_ID),
                ExhibitorEventScope.of(PRINCIPAL_ID),
            ),
        ).toBe(true);
        expect(eventScopesEqual(PlatformEventScope.of(), PlatformEventScope.of())).toBe(true);
    });

    it.each([
        ['club vs exhibitor', ClubEventScope.of(CLUB_ID), ExhibitorEventScope.of(PRINCIPAL_ID)],
        ['club vs platform', ClubEventScope.of(CLUB_ID), PlatformEventScope.of()],
        ['exhibitor vs platform', ExhibitorEventScope.of(PRINCIPAL_ID), PlatformEventScope.of()],
    ])('does not equal across kinds (%s)', (_label, a, b) => {
        expect(eventScopesEqual(a, b)).toBe(false);
        expect(eventScopesEqual(b, a)).toBe(false);
    });

    it('does not equal two club scopes with differing clubIds', () => {
        expect(eventScopesEqual(ClubEventScope.of(CLUB_ID), ClubEventScope.of(CLUB_ID_B))).toBe(
            false,
        );
    });
});

describe('asEventScope', () => {
    it('rehydrates a club scope from kind + clubId', () => {
        const scope = asEventScope('club', CLUB_ID, null);
        expect(eventScopesEqual(scope, ClubEventScope.of(CLUB_ID))).toBe(true);
    });

    it('rehydrates an exhibitor scope from kind + principalId', () => {
        const scope = asEventScope('exhibitor', null, PRINCIPAL_ID);
        expect(eventScopesEqual(scope, ExhibitorEventScope.of(PRINCIPAL_ID))).toBe(true);
    });

    it('rehydrates a platform scope from kind alone', () => {
        const scope = asEventScope('platform', null, null);
        expect(eventScopesEqual(scope, PlatformEventScope.of())).toBe(true);
    });

    it.each([
        ['club without a clubId', 'club', null, null],
        ['club with a principalId', 'club', CLUB_ID, PRINCIPAL_ID],
        ['exhibitor without a principalId', 'exhibitor', null, null],
        ['exhibitor with a clubId', 'exhibitor', CLUB_ID, PRINCIPAL_ID],
        ['platform with a clubId', 'platform', CLUB_ID, null],
        ['platform with a principalId', 'platform', null, PRINCIPAL_ID],
        ['an unknown kind', 'bogus', null, null],
    ])('throws TypeError for %s', (_label, kind, clubId, principalId) => {
        expect(() => asEventScope(kind, clubId, principalId)).toThrow(TypeError);
    });
});
