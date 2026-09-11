// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
    type TransactionScope,
} from '../../../../../src/Shared/index.js';
import { asEntryId, asShowId } from '../../../../../src/sample/domain/shared/domain-ids.js';
import {
    Entry,
    InvalidTransactionScopeError,
} from '../../../../../src/sample/domain/model/entry/entry.js';

const CLUB_ID = '00000000-0000-4000-8000-000000000001';
const PRINCIPAL_ID = '00000000-0000-4000-8000-000000000011';
const SHOW_ID = '00000000-0000-4000-8000-000000000021';
const ENTRY_ID = '00000000-0000-4000-8000-000000000031';

const clubScope = ClubTransactionScope.of(asClubId(CLUB_ID), asPrincipalId(PRINCIPAL_ID));

describe('Entry.submit', () => {
    it('derives clubId and principalId from a club scope', () => {
        const entry = Entry.submit(clubScope, {
            id: asEntryId(ENTRY_ID),
            showId: asShowId(SHOW_ID),
            dogName: 'Fido',
        });

        expect(entry).toBeInstanceOf(Entry);
        expect(entry.id).toBe(asEntryId(ENTRY_ID));
        expect(entry.clubId).toBe(asClubId(CLUB_ID));
        expect(entry.principalId).toBe(asPrincipalId(PRINCIPAL_ID));
        expect(entry.showId).toBe(asShowId(SHOW_ID));
        expect(entry.dogName).toBe('Fido');
    });

    it.each([
        ['exhibitor', ExhibitorTransactionScope.of(asPrincipalId(PRINCIPAL_ID))],
        ['platform', PlatformTransactionScope.of()],
    ])('rejects a %s scope because an Entry is Club-owned', (_label, scope: TransactionScope) => {
        expect(() =>
            Entry.submit(scope, {
                id: asEntryId(ENTRY_ID),
                showId: asShowId(SHOW_ID),
                dogName: 'Fido',
            }),
        ).toThrow(InvalidTransactionScopeError);
    });

    it('InvalidTransactionScopeError carries the offending scope kind', () => {
        let caught: unknown;
        try {
            Entry.submit(ExhibitorTransactionScope.of(asPrincipalId(PRINCIPAL_ID)), {
                id: asEntryId(ENTRY_ID),
                showId: asShowId(SHOW_ID),
                dogName: 'Fido',
            });
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(InvalidTransactionScopeError);
        expect((caught as InvalidTransactionScopeError).received).toBe('exhibitor');
    });
});

describe('Entry.rehydrate', () => {
    it('rebuilds an Entry from stored fields', () => {
        const entry = Entry.rehydrate({
            id: asEntryId(ENTRY_ID),
            clubId: asClubId(CLUB_ID),
            principalId: asPrincipalId(PRINCIPAL_ID),
            showId: asShowId(SHOW_ID),
            dogName: 'Fido',
        });

        expect(entry).toBeInstanceOf(Entry);
        expect(entry.id).toBe(asEntryId(ENTRY_ID));
        expect(entry.clubId).toBe(asClubId(CLUB_ID));
    });

    it('rehydrates equal-by-field to a submitted entry of the same data', () => {
        const submitted = Entry.submit(clubScope, {
            id: asEntryId(ENTRY_ID),
            showId: asShowId(SHOW_ID),
            dogName: 'Fido',
        });
        const rehydrated = Entry.rehydrate({
            id: submitted.id,
            clubId: submitted.clubId,
            principalId: submitted.principalId,
            showId: submitted.showId,
            dogName: submitted.dogName,
        });

        expect(rehydrated).toEqual(submitted);
    });
});

describe('Entry nominal brand', () => {
    it('is not assignable from a structural object literal (the #brand closes the leak)', () => {
        // A bare { id, clubId, … } literal lacks the private #brand field, so
        // it is not assignable to `Entry` — mirrors RoleGrant / LocalDate.
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAnEntry: Entry = {
            id: asEntryId(ENTRY_ID),
            clubId: asClubId(CLUB_ID),
            principalId: asPrincipalId(PRINCIPAL_ID),
            showId: asShowId(SHOW_ID),
            dogName: 'Fido',
        };
        expect(notAnEntry).toBeDefined();
    });
});
