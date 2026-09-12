// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    ClassDefinition,
    InvalidClassAgeRangeError,
    type ClassDefinitionAttributes,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/entities/class-definition.js';
import {
    asClassId,
    asGradeScaleId,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { asAgeMonths } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';

const baseAttributes: ClassDefinitionAttributes = {
    id: asClassId('open'),
    fromAgeMonths: undefined,
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: asGradeScaleId('adult'),
    awardTypeIds: [],
};

describe('ClassDefinition.of', () => {
    it('constructs when fromAgeMonths < lessThanAgeMonths', () => {
        const classDef = ClassDefinition.of({
            ...baseAttributes,
            fromAgeMonths: asAgeMonths(6),
            lessThanAgeMonths: asAgeMonths(9),
        });
        expect(classDef.fromAgeMonths).toBe(6);
        expect(classDef.lessThanAgeMonths).toBe(9);
    });

    it('constructs when only fromAgeMonths is set', () => {
        const classDef = ClassDefinition.of({ ...baseAttributes, fromAgeMonths: asAgeMonths(15) });
        expect(classDef.fromAgeMonths).toBe(15);
    });

    it('constructs when only lessThanAgeMonths is set', () => {
        const classDef = ClassDefinition.of({
            ...baseAttributes,
            lessThanAgeMonths: asAgeMonths(6),
        });
        expect(classDef.lessThanAgeMonths).toBe(6);
    });

    it('constructs when both bounds are undefined', () => {
        const classDef = ClassDefinition.of(baseAttributes);
        expect(classDef.fromAgeMonths).toBeUndefined();
        expect(classDef.lessThanAgeMonths).toBeUndefined();
    });

    it('rejects fromAgeMonths equal to lessThanAgeMonths', () => {
        expect(() =>
            ClassDefinition.of({
                ...baseAttributes,
                fromAgeMonths: asAgeMonths(9),
                lessThanAgeMonths: asAgeMonths(9),
            }),
        ).toThrow(InvalidClassAgeRangeError);
    });

    it('rejects fromAgeMonths greater than lessThanAgeMonths', () => {
        expect(() =>
            ClassDefinition.of({
                ...baseAttributes,
                fromAgeMonths: asAgeMonths(10),
                lessThanAgeMonths: asAgeMonths(9),
            }),
        ).toThrow(InvalidClassAgeRangeError);
    });

    it('InvalidClassAgeRangeError carries the offending class id and bounds', () => {
        try {
            ClassDefinition.of({
                ...baseAttributes,
                fromAgeMonths: asAgeMonths(10),
                lessThanAgeMonths: asAgeMonths(9),
            });
            throw new Error('expected ClassDefinition.of to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidClassAgeRangeError);
            const invalid = error as InvalidClassAgeRangeError;
            expect(invalid.classId).toBe(asClassId('open'));
            expect(invalid.fromAgeMonths).toBe(10);
            expect(invalid.lessThanAgeMonths).toBe(9);
            expect(invalid.name).toBe('InvalidClassAgeRangeError');
        }
    });
});
