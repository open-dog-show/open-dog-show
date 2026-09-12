// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    asAgeMonths,
    InvalidAgeMonthsError,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';
import type { AgeMonths } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';

describe('asAgeMonths', () => {
    it('casts a raw number to an AgeMonths, preserving the value', () => {
        expect(asAgeMonths(15)).toBe(15);
    });

    it('accepts zero (the lower bound)', () => {
        expect(asAgeMonths(0)).toBe(0);
    });

    it('returns an AgeMonths-branded value', () => {
        expectTypeOf(asAgeMonths(15)).toEqualTypeOf<AgeMonths>();
    });

    it('does not accept a bare number where AgeMonths is expected', () => {
        // The brand is compile-time only: a plain number must not satisfy the
        // AgeMonths type, so a bare `15` is rejected where AgeMonths is required.
        // @ts-expect-error — a bare number is not an AgeMonths
        const age: AgeMonths = 15;
        expect(age).toBe(15);
    });

    it.each([
        ['negative', -1],
        ['non-integer', 1.5],
        ['NaN', Number.NaN],
    ])('rejects %s months', (_label, months) => {
        expect(() => asAgeMonths(months)).toThrow(InvalidAgeMonthsError);
    });

    it('InvalidAgeMonthsError carries the offending value', () => {
        try {
            asAgeMonths(-1);
            throw new Error('expected asAgeMonths to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidAgeMonthsError);
            const invalid = error as InvalidAgeMonthsError;
            expect(invalid.months).toBe(-1);
            expect(invalid.name).toBe('InvalidAgeMonthsError');
        }
    });
});
