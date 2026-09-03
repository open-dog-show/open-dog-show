// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { meetsAwardRequirements } from '../testing/meets-award-requirements.js';
import type { GradeId } from '../domain/domain-ids.js';
import {
    asAwardTypeId,
    asClassId,
    asGradeId,
    asGradeScaleId,
    asRulesetLayerId,
} from '../domain/domain-ids.js';
import { asAgeMonths } from '../domain/age-months.js';
import { asEntryRef } from '../domain/entry-ref.js';
import type { IndividualAwardType } from '../domain/award-type.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { GradeScale } from '../domain/grade-scale.js';
import type { EffectiveRuleset } from '../domain/effective-ruleset.js';
import { LocalDate } from '../domain/local-date.js';
import type { ClassPlacement } from '../domain/judging-scope-results.js';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const EXCELLENT = asGradeId('excellent');
const VERY_GOOD = asGradeId('very-good');
const GRADE_SCALE_ID = asGradeScaleId('fci-standard');
const OPEN_CLASS_ID = asClassId('open');
const CACIB_ID = asAwardTypeId('cacib');
const UNKNOWN_GRADE_ID = asGradeId('does-not-exist');

const gradeScale: GradeScale = {
    id: GRADE_SCALE_ID,
    grades: [
        { id: EXCELLENT, ordinal: 0 },
        { id: VERY_GOOD, ordinal: 1 },
    ],
    placeableThresholdId: VERY_GOOD,
    specialOutcomes: [],
};

const classDefinition: ClassDefinition = {
    id: OPEN_CLASS_ID,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: GRADE_SCALE_ID,
    awardTypeIds: [CACIB_ID],
};

const cacib: IndividualAwardType = {
    id: CACIB_ID,
    minimumGradeId: EXCELLENT,
    minimumPlacement: 1,
    isDiscretionary: true,
    scope: 'per-sex',
};

const RULESET: EffectiveRuleset = {
    resolvedAt: LocalDate.of(2026, 1, 1),
    sourceLayerIds: [asRulesetLayerId('fci')],
    classDefinitions: [classDefinition],
    gradeScales: [gradeScale],
    awardTypes: [cacib],
    showTypes: [],
};

const placement = (
    gradeId: GradeId,
    ordinalPlacement: number | undefined,
    classId = OPEN_CLASS_ID,
): ClassPlacement => ({
    classId,
    dogRef: asEntryRef('dog-1'),
    gradeId,
    placement: ordinalPlacement,
});

// ---------------------------------------------------------------------------
// meetsAwardRequirements
// ---------------------------------------------------------------------------

describe('meetsAwardRequirements', () => {
    it('meets when the grade is at least the minimum and the placement is at least the minimum', () => {
        const result = meetsAwardRequirements(
            placement(EXCELLENT, 1),
            cacib,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({ meets: true });
    });

    it('does not meet when the grade is below the minimum', () => {
        const result = meetsAwardRequirements(
            placement(VERY_GOOD, 1),
            cacib,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({
            meets: false,
            reason: `Dog 'dog-1' received grade 'very-good' but 'cacib' requires at least 'excellent'`,
        });
    });

    it('does not meet when the placement is worse than the minimum', () => {
        const result = meetsAwardRequirements(
            placement(EXCELLENT, 2),
            cacib,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({
            meets: false,
            reason: `Dog 'dog-1' has placement 2 but 'cacib' requires placement 1 or better`,
        });
    });

    it('does not meet when a placement is required but the dog was not placed', () => {
        const result = meetsAwardRequirements(
            placement(EXCELLENT, undefined),
            cacib,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({
            meets: false,
            reason: `Dog 'dog-1' has placement undefined but 'cacib' requires placement 1 or better`,
        });
    });

    it('meets when no minimum placement is required', () => {
        const awardWithoutPlacement: IndividualAwardType = {
            id: CACIB_ID,
            minimumGradeId: EXCELLENT,
            minimumPlacement: undefined,
            isDiscretionary: false,
            scope: 'breed',
        };

        const result = meetsAwardRequirements(
            placement(EXCELLENT, undefined),
            awardWithoutPlacement,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({ meets: true });
    });

    it('does not meet when the dog grade is unknown in the class grade scale', () => {
        const result = meetsAwardRequirements(
            placement(UNKNOWN_GRADE_ID, 1),
            cacib,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({
            meets: false,
            reason: `Unknown grade 'does-not-exist' in grade scale 'fci-standard'`,
        });
    });

    it('does not meet when the award minimum grade is unknown in the class grade scale', () => {
        const awardWithUnknownMinGrade: IndividualAwardType = {
            id: CACIB_ID,
            minimumGradeId: UNKNOWN_GRADE_ID,
            minimumPlacement: 1,
            isDiscretionary: true,
            scope: 'per-sex',
        };

        const result = meetsAwardRequirements(
            placement(EXCELLENT, 1),
            awardWithUnknownMinGrade,
            classDefinition,
            RULESET,
        );

        expect(result).toEqual({
            meets: false,
            reason: `Award type 'cacib' references unknown minimum grade 'does-not-exist'`,
        });
    });
});
