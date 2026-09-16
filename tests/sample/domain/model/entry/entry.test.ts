// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { asClubId, asPrincipalId, ClubEventScope } from '../../../../../src/Shared/index.js';
import { asEntryId, asShowId } from '../../../../../src/sample/domain/shared/domain-ids.js';
import { Entry } from '../../../../../src/sample/domain/model/entry/entry.js';
import { EntrySubmitted } from '../../../../../src/sample/domain/model/entry/events/entry-submitted.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_ID_B = asClubId('00000000-0000-4000-8000-000000000002');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const SHOW_ID = asShowId('00000000-0000-4000-8000-000000000021');
const ENTRY_ID = asEntryId('00000000-0000-4000-8000-000000000031');

describe('Entry.submit', () => {
    it('builds an Entry from typed owner ids, not a TransactionScope', () => {
        const entry = Entry.submit({
            id: ENTRY_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            showId: SHOW_ID,
            dogName: 'Fido',
        });

        expect(entry).toBeInstanceOf(Entry);
        expect(entry.id).toBe(ENTRY_ID);
        expect(entry.clubId).toBe(CLUB_ID);
        expect(entry.createdBy).toBe(PRINCIPAL_ID);
        expect(entry.showId).toBe(SHOW_ID);
        expect(entry.dogName).toBe('Fido');
    });

    it('is a hybrid aggregate: the owning clubId need not match any acting scope — it is just an input', () => {
        // An Exhibitor entering a Dog into Club B's Show: the acting principal
        // has nothing to do with Club A. This is exactly the case ADR-0026
        // exists for — an Entry is Club-owned by the Show's Club, not by
        // whoever is acting.
        const entry = Entry.submit({
            id: ENTRY_ID,
            clubId: CLUB_ID_B,
            createdBy: PRINCIPAL_ID,
            showId: SHOW_ID,
            dogName: 'Fido',
        });

        expect(entry.clubId).toBe(CLUB_ID_B);
        expect(entry.createdBy).toBe(PRINCIPAL_ID);
    });

    it('records an EntrySubmitted fact scoped to the owning Club', () => {
        const entry = Entry.submit({
            id: ENTRY_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            showId: SHOW_ID,
            dogName: 'Fido',
        });

        const facts = entry.pullEvents();

        expect(facts).toHaveLength(1);
        const fact = facts[0]!;
        expect(fact).toBeInstanceOf(EntrySubmitted);
        expect(fact.type).toBe('sample.EntrySubmitted');
        expect(fact.scope).toStrictEqual(ClubEventScope.of(CLUB_ID));
        expect(fact.aggregateId).toBe(ENTRY_ID);
        expect(fact.payload).toStrictEqual({ dogName: 'Fido' });
    });
});

describe('Entry.rehydrate', () => {
    it('rebuilds an Entry from stored fields, recording no event', () => {
        const entry = Entry.rehydrate({
            id: ENTRY_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            showId: SHOW_ID,
            dogName: 'Fido',
        });

        expect(entry).toBeInstanceOf(Entry);
        expect(entry.id).toBe(ENTRY_ID);
        expect(entry.clubId).toBe(CLUB_ID);
        expect(entry.pullEvents()).toEqual([]);
    });

    it('rehydrates equal-by-field to a submitted entry of the same data', () => {
        const submitted = Entry.submit({
            id: ENTRY_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            showId: SHOW_ID,
            dogName: 'Fido',
        });
        const rehydrated = Entry.rehydrate({
            id: submitted.id,
            clubId: submitted.clubId,
            createdBy: submitted.createdBy,
            showId: submitted.showId,
            dogName: submitted.dogName,
        });

        // `toEqual` (not `toStrictEqual`): the private `#brand` and the
        // AggregateRoot's internal event buffer are not own enumerable
        // properties, so only the five public domain fields are compared —
        // whether `submitted` still has an unpulled event queued does not
        // affect this comparison.
        expect(rehydrated).toEqual(submitted);
    });
});

describe('Entry nominal brand', () => {
    it('is not assignable from a structural object literal (the #brand closes the leak)', () => {
        // A bare { id, clubId, … } literal lacks the private #brand field, so
        // it is not assignable to `Entry` — mirrors RoleGrant / LocalDate.
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAnEntry: Entry = {
            id: ENTRY_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            showId: SHOW_ID,
            dogName: 'Fido',
        };
        expect(notAnEntry).toBeDefined();
    });
});
