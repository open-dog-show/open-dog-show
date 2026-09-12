// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    Grade,
    GradeScale,
    UnknownPlaceableThresholdError,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import { InvalidGradeOrdinalError } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/grade-ordinal.js';
import {
    asGradeId,
    asGradeScaleId,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';

const EXCELLENT = asGradeId('excellent');
const VERY_GOOD = asGradeId('very-good');
const GOOD = asGradeId('good');

describe('Grade.of', () => {
    it('constructs a Grade with the given id and ordinal', () => {
        const grade = Grade.of(EXCELLENT, 0);
        expect(grade.id).toBe(EXCELLENT);
        expect(grade.ordinal).toBe(0);
    });

    it.each([
        ['negative', -1],
        ['non-integer', 1.5],
        ['NaN', Number.NaN],
    ])('rejects a %s ordinal', (_label, ordinal) => {
        expect(() => Grade.of(EXCELLENT, ordinal)).toThrow(InvalidGradeOrdinalError);
    });
});

describe('Grade.isAtLeast', () => {
    it('a lower ordinal is at least as good as a higher one (better grade)', () => {
        expect(Grade.of(EXCELLENT, 0).isAtLeast(Grade.of(VERY_GOOD, 1))).toBe(true);
    });

    it('equal ordinals are at least as good', () => {
        expect(Grade.of(EXCELLENT, 0).isAtLeast(Grade.of(EXCELLENT, 0))).toBe(true);
    });

    it('a higher ordinal is not at least as good as a lower one (worse grade)', () => {
        expect(Grade.of(VERY_GOOD, 1).isAtLeast(Grade.of(EXCELLENT, 0))).toBe(false);
    });
});

describe('GradeScale.of', () => {
    it('constructs a scale when placeableThresholdId is among grades', () => {
        const scale = GradeScale.of({
            id: asGradeScaleId('adult'),
            grades: [Grade.of(EXCELLENT, 0), Grade.of(VERY_GOOD, 1)],
            placeableThresholdId: VERY_GOOD,
            specialOutcomes: [],
        });
        expect(scale.placeableThresholdId).toBe(VERY_GOOD);
    });

    it('rejects a placeableThresholdId not among grades', () => {
        expect(() =>
            GradeScale.of({
                id: asGradeScaleId('adult'),
                grades: [Grade.of(EXCELLENT, 0), Grade.of(VERY_GOOD, 1)],
                placeableThresholdId: GOOD,
                specialOutcomes: [],
            }),
        ).toThrow(UnknownPlaceableThresholdError);
    });

    it('rejects a placeableThresholdId when grades is empty', () => {
        expect(() =>
            GradeScale.of({
                id: asGradeScaleId('empty'),
                grades: [],
                placeableThresholdId: EXCELLENT,
                specialOutcomes: [],
            }),
        ).toThrow(UnknownPlaceableThresholdError);
    });
});

describe('GradeScale.grade', () => {
    const scale = GradeScale.of({
        id: asGradeScaleId('adult'),
        grades: [Grade.of(EXCELLENT, 0), Grade.of(VERY_GOOD, 1)],
        placeableThresholdId: VERY_GOOD,
        specialOutcomes: [],
    });

    it('returns the Grade with the given id', () => {
        expect(scale.grade(EXCELLENT)?.ordinal).toBe(0);
    });

    it('returns undefined when the grade is not on the scale', () => {
        expect(scale.grade(GOOD)).toBeUndefined();
    });
});
