// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    BraceCoupleCompetitionResults,
    BreedersGroupCompetitionResults,
    ProgenyGroupCompetitionResults,
} from '../../../../../src/rulesets/domain/service/collective-award-policy/collective-competition-results.js';
import { BreedVarietyRef } from '../../../../../src/rulesets/domain/service/collective-award-policy/breed-variety-ref.js';
import { CollectiveEntry } from '../../../../../src/rulesets/domain/service/collective-award-policy/collective-entry.js';
import { asBreedId, asVarietyId } from '../../../../../src/rulesets/domain/shared/domain-ids.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/service/collective-award-policy/entry-ref.js';

const BREED_A = asBreedId('labrador');
const BREED_B = asBreedId('poodle');
const VARIETY_A = asVarietyId('standard');

const REF_A = BreedVarietyRef.of(BREED_A, VARIETY_A);
const REF_B = BreedVarietyRef.of(BREED_B, VARIETY_A);
const ENTRIES_A = [CollectiveEntry.of(asEntryRef('dog-1'), 'male')];
const ENTRIES_B = [CollectiveEntry.of(asEntryRef('dog-2'), 'female')];

describe('BraceCoupleCompetitionResults.equals', () => {
    it('is true when breed and entries match', () => {
        expect(
            BraceCoupleCompetitionResults.of({ breed: REF_A, entries: ENTRIES_A }).equals(
                BraceCoupleCompetitionResults.of({ breed: REF_A, entries: ENTRIES_A }),
            ),
        ).toBe(true);
    });

    it('is false when breed differs', () => {
        expect(
            BraceCoupleCompetitionResults.of({ breed: REF_A, entries: ENTRIES_A }).equals(
                BraceCoupleCompetitionResults.of({ breed: REF_B, entries: ENTRIES_A }),
            ),
        ).toBe(false);
    });

    it('is false when entries differ', () => {
        expect(
            BraceCoupleCompetitionResults.of({ breed: REF_A, entries: ENTRIES_A }).equals(
                BraceCoupleCompetitionResults.of({ breed: REF_A, entries: ENTRIES_B }),
            ),
        ).toBe(false);
    });
});

describe('BreedersGroupCompetitionResults.equals', () => {
    it('is true when breed, kennelName, and entries match', () => {
        expect(
            BreedersGroupCompetitionResults.of({
                breed: REF_A,
                kennelName: 'Von der Grafschaft',
                entries: ENTRIES_A,
            }).equals(
                BreedersGroupCompetitionResults.of({
                    breed: REF_A,
                    kennelName: 'Von der Grafschaft',
                    entries: ENTRIES_A,
                }),
            ),
        ).toBe(true);
    });

    it('is false when kennelName differs', () => {
        expect(
            BreedersGroupCompetitionResults.of({
                breed: REF_A,
                kennelName: 'Von der Grafschaft',
                entries: ENTRIES_A,
            }).equals(
                BreedersGroupCompetitionResults.of({
                    breed: REF_A,
                    kennelName: 'Other Kennel',
                    entries: ENTRIES_A,
                }),
            ),
        ).toBe(false);
    });
});

describe('ProgenyGroupCompetitionResults.equals', () => {
    it('is true when parentEntryRef and entries match', () => {
        expect(
            ProgenyGroupCompetitionResults.of({
                parentEntryRef: asEntryRef('sire-1'),
                entries: ENTRIES_A,
            }).equals(
                ProgenyGroupCompetitionResults.of({
                    parentEntryRef: asEntryRef('sire-1'),
                    entries: ENTRIES_A,
                }),
            ),
        ).toBe(true);
    });

    it('is false when parentEntryRef differs', () => {
        expect(
            ProgenyGroupCompetitionResults.of({
                parentEntryRef: asEntryRef('sire-1'),
                entries: ENTRIES_A,
            }).equals(
                ProgenyGroupCompetitionResults.of({
                    parentEntryRef: asEntryRef('sire-2'),
                    entries: ENTRIES_A,
                }),
            ),
        ).toBe(false);
    });

    it('is false when entries differ', () => {
        expect(
            ProgenyGroupCompetitionResults.of({
                parentEntryRef: asEntryRef('sire-1'),
                entries: ENTRIES_A,
            }).equals(
                ProgenyGroupCompetitionResults.of({
                    parentEntryRef: asEntryRef('sire-1'),
                    entries: ENTRIES_B,
                }),
            ),
        ).toBe(false);
    });
});
