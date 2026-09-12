// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    asGradeOrdinal,
    InvalidGradeOrdinalError,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/grade-ordinal.js';
import type { GradeOrdinal } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/grade-ordinal.js';

describe('asGradeOrdinal', () => {
    it('casts a raw number to a GradeOrdinal, preserving the value', () => {
        expect(asGradeOrdinal(0)).toBe(0);
    });

    it('returns a GradeOrdinal-branded value', () => {
        expectTypeOf(asGradeOrdinal(0)).toEqualTypeOf<GradeOrdinal>();
    });

    it('does not accept a bare number where GradeOrdinal is expected', () => {
        // @ts-expect-error — a bare number is not a GradeOrdinal
        const ordinal: GradeOrdinal = 0;
        expect(ordinal).toBe(0);
    });

    it.each([
        ['negative', -1],
        ['non-integer', 1.5],
        ['NaN', Number.NaN],
    ])('rejects %s', (_label, ordinal) => {
        expect(() => asGradeOrdinal(ordinal)).toThrow(InvalidGradeOrdinalError);
    });

    it('InvalidGradeOrdinalError carries the offending value', () => {
        try {
            asGradeOrdinal(-1);
            throw new Error('expected asGradeOrdinal to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidGradeOrdinalError);
            const invalid = error as InvalidGradeOrdinalError;
            expect(invalid.ordinal).toBe(-1);
            expect(invalid.name).toBe('InvalidGradeOrdinalError');
        }
    });
});
