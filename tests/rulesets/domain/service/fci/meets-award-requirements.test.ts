// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { meetsAwardRequirements } from '../../../../../src/rulesets/domain/service/fci/meets-award-requirements.js';
import type { GradeId } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import {
    asAwardTypeId,
    asClassId,
    asGradeId,
    asGradeScaleId,
    asRulesetLayerId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { asAgeMonths } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/entry-ref.js';
import { asPlacement } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/placement.js';
import type { IndividualAwardType } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import {
    PerSexAwardType,
    HigherScopeAwardType,
    AwardFeeder,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import { ClassDefinition } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/class-definition.js';
import {
    GradeScale,
    Grade,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import { RulesetLayer } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/ruleset-layer.js';
import { EffectiveRuleset } from '../../../../../src/rulesets/domain/model/effective-ruleset/effective-ruleset.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import { ClassPlacement } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/judging-scope-results.js';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const EXCELLENT = asGradeId('excellent');
const VERY_GOOD = asGradeId('very-good');
const GRADE_SCALE_ID = asGradeScaleId('test-standard');
const OPEN_CLASS_ID = asClassId('open');
const CACIB_ID = asAwardTypeId('cacib');
const UNKNOWN_GRADE_ID = asGradeId('does-not-exist');

const gradeScale: GradeScale = GradeScale.of({
    id: GRADE_SCALE_ID,
    grades: [Grade.of(EXCELLENT, 0), Grade.of(VERY_GOOD, 1)],
    placeableThresholdId: VERY_GOOD,
    specialOutcomes: [],
});

const classDefinition: ClassDefinition = ClassDefinition.of({
    id: OPEN_CLASS_ID,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: GRADE_SCALE_ID,
    awardTypeIds: [CACIB_ID],
});

const cacib: IndividualAwardType = PerSexAwardType.of({
    id: CACIB_ID,
    minimumGradeId: EXCELLENT,
    worstEligiblePlacement: asPlacement(1),
    isDiscretionary: true,
});

const RULESET: EffectiveRuleset = EffectiveRuleset.resolve(
    [
        RulesetLayer.of({
            id: asRulesetLayerId('fci'),
            parentLayerId: undefined,
            classDefinitions: [classDefinition],
            gradeScales: [gradeScale],
            awardTypes: [cacib],
            showTypes: [],
        }),
    ],
    LocalDate.of(2026, 1, 1),
);

const placement = (
    gradeId: GradeId,
    ordinalPlacement: number | undefined,
    classId = OPEN_CLASS_ID,
): ClassPlacement =>
    ClassPlacement.of({
        classId,
        entryRef: asEntryRef('dog-1'),
        gradeId,
        placement: ordinalPlacement === undefined ? undefined : asPlacement(ordinalPlacement),
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
        const awardWithoutPlacement: IndividualAwardType = HigherScopeAwardType.breed({
            id: CACIB_ID,
            minimumGradeId: EXCELLENT,
            worstEligiblePlacement: undefined,
            isDiscretionary: false,
            fedBy: [AwardFeeder.of(CACIB_ID)],
        });

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
            reason: `Unknown grade 'does-not-exist' in grade scale 'test-standard'`,
        });
    });

    it('does not meet when the award minimum grade is unknown in the class grade scale', () => {
        const awardWithUnknownMinGrade: IndividualAwardType = PerSexAwardType.of({
            id: CACIB_ID,
            minimumGradeId: UNKNOWN_GRADE_ID,
            worstEligiblePlacement: asPlacement(1),
            isDiscretionary: true,
        });

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
