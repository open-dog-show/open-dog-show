// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { FciCollectiveAwardPolicy } from '../../../../../src/rulesets/domain/service/fci/fci-collective-award-policy.js';
import {
    asBreedId,
    asVarietyId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/entry-ref.js';
import type { EntryRef } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/entry-ref.js';
import type { Sex } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/sex.js';
import {
    CollectiveEntry,
    BreedVarietyRef,
    BraceCoupleCompetitionResults,
    BreedersGroupCompetitionResults,
    ProgenyGroupCompetitionResults,
    type CollectiveCompetitionResults,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/collective-competition-results.js';

const BREED_ID = asBreedId('german-shepherd');
const VARIETY_ID = asVarietyId('rough-coated');

const policy = new FciCollectiveAwardPolicy();

const entry = (ref: string, sex: Sex): CollectiveEntry => CollectiveEntry.of(asEntryRef(ref), sex);
const entries = (...pairs: readonly [string, Sex][]) => pairs.map(([ref, sex]) => entry(ref, sex));

const refs = (...refs: readonly string[]): EntryRef[] => refs.map(asEntryRef);

// ---------------------------------------------------------------------------
// Brace/Couple
// ---------------------------------------------------------------------------

describe('FciCollectiveAwardPolicy — Brace/Couple', () => {
    it('returns a winning group when exactly one dog and one bitch are present', () => {
        const results: CollectiveCompetitionResults = BraceCoupleCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            entries: entries(['entry-1', 'male'], ['entry-2', 'female']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toContain(asEntryRef('entry-1'));
            expect(result.winningGroupRefs).toContain(asEntryRef('entry-2'));
            expect(result.winningGroupRefs).toHaveLength(2);
        }
    });

    it('is invalid when both entries are dogs (no bitch present)', () => {
        const results: CollectiveCompetitionResults = BraceCoupleCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            entries: entries(['entry-1', 'male'], ['entry-2', 'male']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/female/i);
        }
    });

    it('is invalid when both entries are bitches (no dog present)', () => {
        const results: CollectiveCompetitionResults = BraceCoupleCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            entries: entries(['entry-1', 'female'], ['entry-2', 'female']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/male/i);
        }
    });

    it('is invalid when fewer than two entries are present', () => {
        const results: CollectiveCompetitionResults = BraceCoupleCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            entries: entries(['entry-1', 'male']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
    });

    it('is invalid when no entries are present', () => {
        const results: CollectiveCompetitionResults = BraceCoupleCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            entries: [],
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
    });

    it('is valid when a variety is specified alongside the breed', () => {
        const results: CollectiveCompetitionResults = BraceCoupleCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, VARIETY_ID),
            entries: entries(['entry-1', 'male'], ['entry-2', 'female']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toContain(asEntryRef('entry-1'));
            expect(result.winningGroupRefs).toContain(asEntryRef('entry-2'));
            expect(result.winningGroupRefs).toHaveLength(2);
        }
    });
});

// ---------------------------------------------------------------------------
// Breeders' Group
// ---------------------------------------------------------------------------

describe("FciCollectiveAwardPolicy — Breeders' Group", () => {
    it('returns a winning group for 3 dogs of the same breed and kennel', () => {
        const results: CollectiveCompetitionResults = BreedersGroupCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            kennelName: 'Von der Grafschaft',
            entries: entries(['entry-1', 'male'], ['entry-2', 'female'], ['entry-3', 'female']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(3);
        }
    });

    it('returns a winning group for 5 dogs (maximum)', () => {
        const results: CollectiveCompetitionResults = BreedersGroupCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            kennelName: 'Von der Grafschaft',
            entries: entries(
                ['entry-1', 'male'],
                ['entry-2', 'female'],
                ['entry-3', 'male'],
                ['entry-4', 'female'],
                ['entry-5', 'male'],
            ),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(5);
        }
    });

    it('is invalid when fewer than 3 dogs are present', () => {
        const results: CollectiveCompetitionResults = BreedersGroupCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            kennelName: 'Von der Grafschaft',
            entries: entries(['entry-1', 'male'], ['entry-2', 'female']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/3/);
        }
    });

    it('is invalid when more than 5 dogs are present', () => {
        const results: CollectiveCompetitionResults = BreedersGroupCompetitionResults.of({
            breed: BreedVarietyRef.of(BREED_ID, undefined),
            kennelName: 'Von der Grafschaft',
            entries: entries(
                ['entry-1', 'male'],
                ['entry-2', 'female'],
                ['entry-3', 'male'],
                ['entry-4', 'female'],
                ['entry-5', 'male'],
                ['entry-6', 'female'],
            ),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/5/);
        }
    });
});

// ---------------------------------------------------------------------------
// Progeny Group
// ---------------------------------------------------------------------------

describe('FciCollectiveAwardPolicy — Progeny Group', () => {
    it('returns a winning group for a sire with 3 offspring (minimum)', () => {
        const results: CollectiveCompetitionResults = ProgenyGroupCompetitionResults.of({
            parentEntryRef: asEntryRef('sire-1'),
            entries: entries(
                ['offspring-1', 'male'],
                ['offspring-2', 'female'],
                ['offspring-3', 'male'],
            ),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(3);
            expect(result.winningGroupRefs).toEqual(
                expect.arrayContaining(refs('offspring-1', 'offspring-2', 'offspring-3')),
            );
        }
    });

    it('returns a winning group for a dam with 5 offspring (maximum)', () => {
        const results: CollectiveCompetitionResults = ProgenyGroupCompetitionResults.of({
            parentEntryRef: asEntryRef('dam-1'),
            entries: entries(
                ['offspring-1', 'male'],
                ['offspring-2', 'female'],
                ['offspring-3', 'male'],
                ['offspring-4', 'female'],
                ['offspring-5', 'male'],
            ),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(5);
        }
    });

    it('is invalid when fewer than 3 offspring are present', () => {
        const results: CollectiveCompetitionResults = ProgenyGroupCompetitionResults.of({
            parentEntryRef: asEntryRef('sire-1'),
            entries: entries(['offspring-1', 'male'], ['offspring-2', 'female']),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/3/);
        }
    });

    it('is invalid when more than 5 offspring are present', () => {
        const results: CollectiveCompetitionResults = ProgenyGroupCompetitionResults.of({
            parentEntryRef: asEntryRef('sire-1'),
            entries: entries(
                ['offspring-1', 'male'],
                ['offspring-2', 'female'],
                ['offspring-3', 'male'],
                ['offspring-4', 'female'],
                ['offspring-5', 'male'],
                ['offspring-6', 'female'],
            ),
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/5/);
        }
    });

    it('is invalid when no offspring are present', () => {
        const results: CollectiveCompetitionResults = ProgenyGroupCompetitionResults.of({
            parentEntryRef: asEntryRef('sire-1'),
            entries: [],
        });

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
    });
});
