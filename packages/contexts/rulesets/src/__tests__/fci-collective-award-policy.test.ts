// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { FciCollectiveAwardPolicy } from '../testing/fci-collective-award-policy.js';
import { asBreedId, asVarietyId } from '../domain/domain-ids.js';
import { asEntryRef } from '../domain/entry-ref.js';
import type { CollectiveCompetitionResults } from '../domain/collective-competition-results.js';

const BREED_ID = asBreedId('german-shepherd');
const VARIETY_ID = asVarietyId('rough-coated');

const policy = new FciCollectiveAwardPolicy();

// ---------------------------------------------------------------------------
// Brace/Couple
// ---------------------------------------------------------------------------

describe('FciCollectiveAwardPolicy — Brace/Couple', () => {
    it('returns a winning group when exactly one dog and one bitch are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'brace-couple',
            breedId: BREED_ID,
            varietyId: undefined,
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toContain(asEntryRef('entry-1'));
            expect(result.winningGroupRefs).toContain(asEntryRef('entry-2'));
            expect(result.winningGroupRefs).toHaveLength(2);
        }
    });

    it('is invalid when both entries are dogs (no bitch present)', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'brace-couple',
            breedId: BREED_ID,
            varietyId: undefined,
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'dog' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/bitch/i);
        }
    });

    it('is invalid when both entries are bitches (no dog present)', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'brace-couple',
            breedId: BREED_ID,
            varietyId: undefined,
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'bitch' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/dog/i);
        }
    });

    it('is invalid when fewer than two entries are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'brace-couple',
            breedId: BREED_ID,
            varietyId: undefined,
            entries: [{ dogRef: asEntryRef('entry-1'), sex: 'dog' }],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
    });

    it('is invalid when no entries are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'brace-couple',
            breedId: BREED_ID,
            varietyId: undefined,
            entries: [],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
    });

    it('is valid when a variety is specified alongside the breed', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'brace-couple',
            breedId: BREED_ID,
            varietyId: VARIETY_ID,
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
            ],
        };

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
        const results: CollectiveCompetitionResults = {
            kind: 'breeders-group',
            breedId: BREED_ID,
            varietyId: undefined,
            kennelName: 'Von der Grafschaft',
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
                { dogRef: asEntryRef('entry-3'), sex: 'bitch' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(3);
        }
    });

    it('returns a winning group for 5 dogs (maximum)', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'breeders-group',
            breedId: BREED_ID,
            varietyId: undefined,
            kennelName: 'Von der Grafschaft',
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
                { dogRef: asEntryRef('entry-3'), sex: 'dog' },
                { dogRef: asEntryRef('entry-4'), sex: 'bitch' },
                { dogRef: asEntryRef('entry-5'), sex: 'dog' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(5);
        }
    });

    it('is invalid when fewer than 3 dogs are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'breeders-group',
            breedId: BREED_ID,
            varietyId: undefined,
            kennelName: 'Von der Grafschaft',
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/3/);
        }
    });

    it('is invalid when more than 5 dogs are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'breeders-group',
            breedId: BREED_ID,
            varietyId: undefined,
            kennelName: 'Von der Grafschaft',
            entries: [
                { dogRef: asEntryRef('entry-1'), sex: 'dog' },
                { dogRef: asEntryRef('entry-2'), sex: 'bitch' },
                { dogRef: asEntryRef('entry-3'), sex: 'dog' },
                { dogRef: asEntryRef('entry-4'), sex: 'bitch' },
                { dogRef: asEntryRef('entry-5'), sex: 'dog' },
                { dogRef: asEntryRef('entry-6'), sex: 'bitch' },
            ],
        };

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
        const results: CollectiveCompetitionResults = {
            kind: 'progeny-group',
            parentDogRef: asEntryRef('sire-1'),
            entries: [
                { dogRef: asEntryRef('offspring-1'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-2'), sex: 'bitch' },
                { dogRef: asEntryRef('offspring-3'), sex: 'dog' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(3);
            expect(result.winningGroupRefs).toContain(asEntryRef('offspring-1'));
            expect(result.winningGroupRefs).toContain(asEntryRef('offspring-2'));
            expect(result.winningGroupRefs).toContain(asEntryRef('offspring-3'));
        }
    });

    it('returns a winning group for a dam with 5 offspring (maximum)', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'progeny-group',
            parentDogRef: asEntryRef('dam-1'),
            entries: [
                { dogRef: asEntryRef('offspring-1'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-2'), sex: 'bitch' },
                { dogRef: asEntryRef('offspring-3'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-4'), sex: 'bitch' },
                { dogRef: asEntryRef('offspring-5'), sex: 'dog' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.winningGroupRefs).toHaveLength(5);
        }
    });

    it('is invalid when fewer than 3 offspring are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'progeny-group',
            parentDogRef: asEntryRef('sire-1'),
            entries: [
                { dogRef: asEntryRef('offspring-1'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-2'), sex: 'bitch' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/3/);
        }
    });

    it('is invalid when more than 5 offspring are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'progeny-group',
            parentDogRef: asEntryRef('sire-1'),
            entries: [
                { dogRef: asEntryRef('offspring-1'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-2'), sex: 'bitch' },
                { dogRef: asEntryRef('offspring-3'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-4'), sex: 'bitch' },
                { dogRef: asEntryRef('offspring-5'), sex: 'dog' },
                { dogRef: asEntryRef('offspring-6'), sex: 'bitch' },
            ],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/5/);
        }
    });

    it('is invalid when no offspring are present', () => {
        const results: CollectiveCompetitionResults = {
            kind: 'progeny-group',
            parentDogRef: asEntryRef('sire-1'),
            entries: [],
        };

        const result = policy.evaluate(results);

        expect(result.valid).toBe(false);
    });
});
