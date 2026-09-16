// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
    requireActor,
    requireClubScope,
    ScopeMismatchError,
} from '../../../src/Shared/index.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');

describe('requireClubScope', () => {
    it('returns the clubId for a club scope', () => {
        const scope = ClubTransactionScope.of(CLUB_ID, PRINCIPAL_ID);
        expect(requireClubScope(scope)).toBe(CLUB_ID);
    });

    it.each([
        ['exhibitor', ExhibitorTransactionScope.of(PRINCIPAL_ID)],
        ['platform', PlatformTransactionScope.of()],
    ])('throws ScopeMismatchError for a %s scope', (_label, scope) => {
        expect(() => requireClubScope(scope)).toThrow(ScopeMismatchError);
    });

    it('ScopeMismatchError carries the expected and received scope kinds', () => {
        let caught: unknown;
        try {
            requireClubScope(PlatformTransactionScope.of());
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(ScopeMismatchError);
        expect((caught as ScopeMismatchError).expected).toBe('club');
        expect((caught as ScopeMismatchError).received).toBe('platform');
        expect((caught as ScopeMismatchError).name).toBe('ScopeMismatchError');
    });
});

describe('requireActor', () => {
    it('returns the principalId for a club scope', () => {
        const scope = ClubTransactionScope.of(CLUB_ID, PRINCIPAL_ID);
        expect(requireActor(scope)).toBe(PRINCIPAL_ID);
    });

    it('returns the principalId for an exhibitor scope', () => {
        const scope = ExhibitorTransactionScope.of(PRINCIPAL_ID);
        expect(requireActor(scope)).toBe(PRINCIPAL_ID);
    });

    it('throws ScopeMismatchError for a platform scope (no acting principal)', () => {
        expect(() => requireActor(PlatformTransactionScope.of())).toThrow(ScopeMismatchError);
    });

    it('ScopeMismatchError carries the offending received scope kind', () => {
        let caught: unknown;
        try {
            requireActor(PlatformTransactionScope.of());
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(ScopeMismatchError);
        expect((caught as ScopeMismatchError).received).toBe('platform');
    });
});
