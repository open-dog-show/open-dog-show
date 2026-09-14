// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { BreedVarietyRef } from '../../../../../src/rulesets/domain/service/collective-award-policy/breed-variety-ref.js';
import { asBreedId, asVarietyId } from '../../../../../src/rulesets/domain/shared/domain-ids.js';

const BREED_A = asBreedId('labrador');
const BREED_B = asBreedId('poodle');
const VARIETY_A = asVarietyId('standard');
const VARIETY_B = asVarietyId('miniature');

describe('BreedVarietyRef.equals', () => {
    it('is true for the same breedId and varietyId', () => {
        expect(
            BreedVarietyRef.of(BREED_A, VARIETY_A).equals(BreedVarietyRef.of(BREED_A, VARIETY_A)),
        ).toBe(true);
    });

    it('is true when both varietyId are undefined', () => {
        expect(
            BreedVarietyRef.of(BREED_A, undefined).equals(BreedVarietyRef.of(BREED_A, undefined)),
        ).toBe(true);
    });

    it('is false when breedId differs', () => {
        expect(
            BreedVarietyRef.of(BREED_A, VARIETY_A).equals(BreedVarietyRef.of(BREED_B, VARIETY_A)),
        ).toBe(false);
    });

    it('is false when varietyId differs', () => {
        expect(
            BreedVarietyRef.of(BREED_A, VARIETY_A).equals(BreedVarietyRef.of(BREED_A, VARIETY_B)),
        ).toBe(false);
    });

    it('is false when one varietyId is undefined and the other is not', () => {
        expect(
            BreedVarietyRef.of(BREED_A, undefined).equals(BreedVarietyRef.of(BREED_A, VARIETY_A)),
        ).toBe(false);
    });
});
