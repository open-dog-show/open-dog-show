// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { resolveEffectiveRuleset } from '../domain/resolve-effective-ruleset.js';
import {
    asClassId,
    asRulesetLayerId,
    asGradeId,
    asGradeScaleId,
    asAwardTypeId,
    asShowTypeId,
} from '../domain/domain-ids.js';
import type { RulesetLayer } from '../domain/ruleset-layer.js';
import type { LocalDate } from '../domain/local-date.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { GradeScale } from '../domain/grade-scale.js';
import type { AwardType } from '../domain/award-type.js';
import type { ShowType } from '../domain/show-type.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TEST_DATE: LocalDate = { year: 2026, month: 8, day: 4 };

function makeLayer(
    id: string,
    overrides: Partial<Omit<RulesetLayer, 'id' | 'name' | 'parentLayerId'>> = {},
): RulesetLayer {
    return {
        id: asRulesetLayerId(id),
        name: `Layer ${id}`,
        parentLayerId: undefined,
        classDefinitions: [],
        gradeScales: [],
        awardTypes: [],
        showTypes: [],
        ...overrides,
    };
}

function makeClass(id: string, name?: string): ClassDefinition {
    return {
        id: asClassId(id),
        name: name ?? `Class ${id}`,
        minAgeDays: undefined,
        maxAgeDays: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: asGradeScaleId('gs-standard'),
        awardTypeIds: [],
    };
}

function makeGradeScale(id: string): GradeScale {
    return {
        id: asGradeScaleId(id),
        name: `Scale ${id}`,
        grades: [],
        placeableThresholdId: asGradeId('placeholder'),
        specialOutcomes: [],
    };
}

function makeAwardType(id: string): AwardType {
    return {
        id: asAwardTypeId(id),
        name: `Award ${id}`,
        minimumGradeId: asGradeId('g1'),
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'breed',
    };
}

function makeShowType(id: string): ShowType {
    return {
        id: asShowTypeId(id),
        name: `ShowType ${id}`,
        availableAwardTypeIds: [],
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveEffectiveRuleset', () => {
    describe('single-layer passthrough', () => {
        it('returns an EffectiveRuleset containing exactly the layer data', () => {
            const classDef = makeClass('c-1');
            const layer = makeLayer('fci', { classDefinitions: [classDef] });

            const result = resolveEffectiveRuleset([layer], TEST_DATE);

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]).toEqual(classDef);
        });
    });

    describe('additive merge', () => {
        it('second layer with a new ClassId adds without removing any base-layer class', () => {
            const base = makeLayer('fci', { classDefinitions: [makeClass('c-1')] });
            const national = makeLayer('srsh', { classDefinitions: [makeClass('c-2')] });

            const result = resolveEffectiveRuleset([base, national], TEST_DATE);

            const ids = result.classDefinitions.map((c) => c.id);
            expect(ids).toContain(asClassId('c-1'));
            expect(ids).toContain(asClassId('c-2'));
            expect(result.classDefinitions).toHaveLength(2);
        });
    });

    describe('override', () => {
        it('second layer with same ClassId replaces the base-layer ClassDefinition wholly', () => {
            const base = makeLayer('fci', {
                classDefinitions: [makeClass('c-1', 'FCI Puppy')],
            });
            const national = makeLayer('srsh', {
                classDefinitions: [makeClass('c-1', 'SRSH Puppy Override')],
            });

            const result = resolveEffectiveRuleset([base, national], TEST_DATE);

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]?.name).toBe('SRSH Puppy Override');
        });
    });

    describe('layer ordering', () => {
        it('last array element wins when two layers share the same ClassId', () => {
            const layer1 = makeLayer('l1', { classDefinitions: [makeClass('c-1', 'First')] });
            const layer2 = makeLayer('l2', { classDefinitions: [makeClass('c-1', 'Second')] });
            const layer3 = makeLayer('l3', { classDefinitions: [makeClass('c-1', 'Third')] });

            const result = resolveEffectiveRuleset([layer1, layer2, layer3], TEST_DATE);

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]?.name).toBe('Third');
        });
    });

    describe('metadata', () => {
        it('carries resolvedAt matching the supplied date', () => {
            const result = resolveEffectiveRuleset([makeLayer('fci')], TEST_DATE);

            expect(result.resolvedAt).toEqual(TEST_DATE);
        });

        it('carries sourceLayerIds listing every input layer id in order', () => {
            const l1 = makeLayer('layer-a');
            const l2 = makeLayer('layer-b');

            const result = resolveEffectiveRuleset([l1, l2], TEST_DATE);

            expect(result.sourceLayerIds).toEqual([
                asRulesetLayerId('layer-a'),
                asRulesetLayerId('layer-b'),
            ]);
        });
    });

    describe('deep copy', () => {
        it('mutating the input classDefinitions array after calling the function does not change the returned snapshot', () => {
            const mutableDefs: ClassDefinition[] = [makeClass('c-1')];
            const layer = makeLayer('fci', { classDefinitions: mutableDefs });

            const result = resolveEffectiveRuleset([layer], TEST_DATE);

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

            const result = resolveEffectiveRuleset([base, national], TEST_DATE);

            expect(result.gradeScales).toHaveLength(1);
            expect(result.awardTypes).toHaveLength(1);
            expect(result.showTypes).toHaveLength(1);
        });
    });
});
