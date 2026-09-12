// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { resolveEffectiveRuleset } from '../../../../src/rulesets/domain/service/resolve-effective-ruleset.js';
import {
    asClassId,
    asRulesetLayerId,
    asGradeId,
    asGradeScaleId,
    asAwardTypeId,
    asShowTypeId,
    asEffectiveRulesetId,
} from '../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { asAgeMonths } from '../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';
import {
    RulesetLayer,
    type RulesetLayerAttributes,
} from '../../../../src/rulesets/domain/model/effective-ruleset/entities/ruleset-layer.js';
import { LocalDate } from '../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import { ClassDefinition } from '../../../../src/rulesets/domain/model/effective-ruleset/entities/class-definition.js';
import {
    GradeScale,
    Grade,
} from '../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import {
    HigherScopeAwardType,
    AwardFeeder,
    type AwardType,
} from '../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import { ShowType } from '../../../../src/rulesets/domain/model/effective-ruleset/entities/show-type.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TEST_DATE: LocalDate = LocalDate.of(2026, 8, 4);
const RULESET_ID = asEffectiveRulesetId('ruleset-1');
const STANDARD_GRADE_SCALE_ID = asGradeScaleId('gs-standard');

function makeGradeScale(id: string): GradeScale {
    const gradeId = asGradeId(`${id}-g1`);
    return GradeScale.of({
        id: asGradeScaleId(id),
        grades: [Grade.of(gradeId, 0)],
        placeableThresholdId: gradeId,
        specialOutcomes: [],
    });
}

function makeLayer(
    id: string,
    overrides: Partial<Omit<RulesetLayerAttributes, 'id' | 'parentLayerId'>> = {},
): RulesetLayer {
    return RulesetLayer.of({
        id: asRulesetLayerId(id),
        parentLayerId: undefined,
        classDefinitions: [],
        gradeScales: [makeGradeScale('gs-standard')],
        awardTypes: [],
        showTypes: [],
        ...overrides,
    });
}

function makeClass(id: string, fromAgeMonths?: number): ClassDefinition {
    return ClassDefinition.of({
        id: asClassId(id),
        fromAgeMonths: fromAgeMonths === undefined ? undefined : asAgeMonths(fromAgeMonths),
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: STANDARD_GRADE_SCALE_ID,
        awardTypeIds: [],
    });
}

function makeAwardType(id: string): AwardType {
    return HigherScopeAwardType.breed({
        id: asAwardTypeId(id),
        minimumGradeId: asGradeId('g1'),
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        fedBy: [AwardFeeder.of(asAwardTypeId(`${id}-feeder`))],
    });
}

function makeShowType(id: string): ShowType {
    return ShowType.of({
        id: asShowTypeId(id),
        availableAwardTypeIds: [],
        availableCollectiveCompetitions: [],
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveEffectiveRuleset', () => {
    describe('single-layer passthrough', () => {
        it('returns an EffectiveRuleset containing exactly the layer data', () => {
            const classDef = makeClass('c-1');
            const layer = makeLayer('fci', { classDefinitions: [classDef] });

            const result = resolveEffectiveRuleset(RULESET_ID, [layer], TEST_DATE);

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]).toEqual(classDef);
        });
    });

    describe('additive merge', () => {
        it('second layer with a new ClassId adds without removing any base-layer class', () => {
            const base = makeLayer('fci', { classDefinitions: [makeClass('c-1')] });
            const national = makeLayer('srsh', { classDefinitions: [makeClass('c-2')] });

            const result = resolveEffectiveRuleset(RULESET_ID, [base, national], TEST_DATE);

            const ids = result.classDefinitions.map((c) => c.id);
            expect(ids).toContain(asClassId('c-1'));
            expect(ids).toContain(asClassId('c-2'));
            expect(result.classDefinitions).toHaveLength(2);
        });
    });

    describe('override', () => {
        it('second layer with same ClassId replaces the base-layer ClassDefinition wholly', () => {
            const base = makeLayer('fci', {
                classDefinitions: [makeClass('c-1', 9)],
            });
            const national = makeLayer('srsh', {
                classDefinitions: [makeClass('c-1', 3)],
            });

            const result = resolveEffectiveRuleset(RULESET_ID, [base, national], TEST_DATE);

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]?.fromAgeMonths).toBe(3);
        });
    });

    describe('layer ordering', () => {
        it('last array element wins when two layers share the same ClassId', () => {
            const layer1 = makeLayer('l1', { classDefinitions: [makeClass('c-1', 9)] });
            const layer2 = makeLayer('l2', { classDefinitions: [makeClass('c-1', 15)] });
            const layer3 = makeLayer('l3', { classDefinitions: [makeClass('c-1', 18)] });

            const result = resolveEffectiveRuleset(RULESET_ID, [layer1, layer2, layer3], TEST_DATE);

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]?.fromAgeMonths).toBe(18);
        });
    });

    describe('metadata', () => {
        it('carries an id matching the supplied EffectiveRulesetId', () => {
            const result = resolveEffectiveRuleset(RULESET_ID, [makeLayer('fci')], TEST_DATE);

            expect(result.id).toBe(RULESET_ID);
        });

        it('carries resolvedFor matching the supplied date', () => {
            const result = resolveEffectiveRuleset(RULESET_ID, [makeLayer('fci')], TEST_DATE);

            expect(result.resolvedFor).toEqual(TEST_DATE);
        });

        it('carries sourceLayerIds listing every input layer id in order', () => {
            const l1 = makeLayer('layer-a');
            const l2 = makeLayer('layer-b');

            const result = resolveEffectiveRuleset(RULESET_ID, [l1, l2], TEST_DATE);

            expect(result.sourceLayerIds).toEqual([
                asRulesetLayerId('layer-a'),
                asRulesetLayerId('layer-b'),
            ]);
        });
    });

    describe('array isolation', () => {
        it('mutating the input classDefinitions array after calling the function does not change the returned snapshot', () => {
            const mutableDefs: ClassDefinition[] = [makeClass('c-1')];
            const layer = makeLayer('fci', { classDefinitions: mutableDefs });

            const result = resolveEffectiveRuleset(RULESET_ID, [layer], TEST_DATE);

            // Mutate after resolution
            mutableDefs.push(makeClass('c-extra'));

            expect(result.classDefinitions).toHaveLength(1);
        });
    });

    describe('all collection types are merged', () => {
        it('gradeScales, awardTypes and showTypes also follow last-wins override', () => {
            const base = makeLayer('fci', {
                gradeScales: [makeGradeScale('gs-1')],
                awardTypes: [makeAwardType('at-1')],
                showTypes: [makeShowType('st-1')],
            });
            const national = makeLayer('srsh', {
                gradeScales: [makeGradeScale('gs-1')],
                awardTypes: [makeAwardType('at-1')],
                showTypes: [makeShowType('st-1')],
            });

            const result = resolveEffectiveRuleset(RULESET_ID, [base, national], TEST_DATE);

            expect(result.gradeScales).toHaveLength(1);
            expect(result.awardTypes).toHaveLength(1);
            expect(result.showTypes).toHaveLength(1);
        });
    });
});
