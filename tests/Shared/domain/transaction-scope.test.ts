// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
    transactionScopesEqual,
} from '../../../src/Shared/index.js';

const CLUB_A = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_B = asClubId('00000000-0000-4000-8000-000000000002');
const PRINCIPAL_A = asPrincipalId('00000000-0000-4000-8000-000000000011');
const PRINCIPAL_B = asPrincipalId('00000000-0000-4000-8000-000000000012');

describe('TransactionScope variant equality', () => {
    it('ClubTransactionScope.equals is true for the same clubId + principalId', () => {
        expect(
            ClubTransactionScope.of(CLUB_A, PRINCIPAL_A).equals(
                ClubTransactionScope.of(CLUB_A, PRINCIPAL_A),
            ),
        ).toBe(true);
    });

    it('ClubTransactionScope.equals is false when the clubId differs', () => {
        expect(
            ClubTransactionScope.of(CLUB_A, PRINCIPAL_A).equals(
                ClubTransactionScope.of(CLUB_B, PRINCIPAL_A),
            ),
        ).toBe(false);
    });

    it('ClubTransactionScope.equals is false when the principalId differs', () => {
        expect(
            ClubTransactionScope.of(CLUB_A, PRINCIPAL_A).equals(
                ClubTransactionScope.of(CLUB_A, PRINCIPAL_B),
            ),
        ).toBe(false);
    });

    it('ExhibitorTransactionScope.equals is true for the same principalId', () => {
        expect(
            ExhibitorTransactionScope.of(PRINCIPAL_A).equals(
                ExhibitorTransactionScope.of(PRINCIPAL_A),
            ),
        ).toBe(true);
    });

    it('ExhibitorTransactionScope.equals is false when the principalId differs', () => {
        expect(
            ExhibitorTransactionScope.of(PRINCIPAL_A).equals(
                ExhibitorTransactionScope.of(PRINCIPAL_B),
            ),
        ).toBe(false);
    });

    it('PlatformTransactionScope.equals is true for any two platform scopes (data-less)', () => {
        expect(PlatformTransactionScope.of().equals(PlatformTransactionScope.of())).toBe(true);
    });
});

describe('transactionScopesEqual', () => {
    it('equals two club scopes with matching ids', () => {
        expect(
            transactionScopesEqual(
                ClubTransactionScope.of(CLUB_A, PRINCIPAL_A),
                ClubTransactionScope.of(CLUB_A, PRINCIPAL_A),
            ),
        ).toBe(true);
    });

    it('does not equal two club scopes with differing clubIds', () => {
        expect(
            transactionScopesEqual(
                ClubTransactionScope.of(CLUB_A, PRINCIPAL_A),
                ClubTransactionScope.of(CLUB_B, PRINCIPAL_A),
            ),
        ).toBe(false);
    });

    it('equals two exhibitor scopes with the same principalId', () => {
        expect(
            transactionScopesEqual(
                ExhibitorTransactionScope.of(PRINCIPAL_A),
                ExhibitorTransactionScope.of(PRINCIPAL_A),
            ),
        ).toBe(true);
    });

    it('equals two platform scopes', () => {
        expect(
            transactionScopesEqual(PlatformTransactionScope.of(), PlatformTransactionScope.of()),
        ).toBe(true);
    });

    it.each([
        [
            'club vs exhibitor',
            ClubTransactionScope.of(CLUB_A, PRINCIPAL_A),
            ExhibitorTransactionScope.of(PRINCIPAL_A),
        ],
        [
            'club vs platform',
            ClubTransactionScope.of(CLUB_A, PRINCIPAL_A),
            PlatformTransactionScope.of(),
        ],
        [
            'exhibitor vs platform',
            ExhibitorTransactionScope.of(PRINCIPAL_A),
            PlatformTransactionScope.of(),
        ],
    ])('does not equal across variants (%s)', (_label, a, b) => {
        expect(transactionScopesEqual(a, b)).toBe(false);
        expect(transactionScopesEqual(b, a)).toBe(false);
    });
});
