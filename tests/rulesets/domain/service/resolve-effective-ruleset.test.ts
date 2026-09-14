// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    resolveEffectiveRuleset,
    NoEditionInForceError,
} from '../../../../src/rulesets/domain/service/resolve-effective-ruleset.js';
import {
    asClassId,
    asRulesetLayerId,
    asGradeId,
    asGradeScaleId,
    asAwardTypeId,
    asShowTypeId,
    asEffectiveRulesetId,
} from '../../../../src/rulesets/domain/shared/domain-ids.js';
import type { RulesetLayerId } from '../../../../src/rulesets/domain/shared/domain-ids.js';
import { asAgeMonths } from '../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';
import {
    RulesetLayerEdition,
    type RulesetLayerEditionAttributes,
} from '../../../../src/rulesets/domain/model/ruleset-layer-edition/ruleset-layer-edition.js';
import type { RulesetLayerEditionRepository } from '../../../../src/rulesets/domain/model/ruleset-layer-edition/ruleset-layer-edition-repository.js';
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

function makeEdition(
    layerId: string,
    overrides: Partial<Omit<RulesetLayerEditionAttributes, 'layerId'>> = {},
): RulesetLayerEdition {
    return RulesetLayerEdition.of({
        layerId: asRulesetLayerId(layerId),
        effectiveFrom: TEST_DATE,
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

/**
 * A test double implementing the real "latest, on-or-before" selection via
 * {@link RulesetLayerEdition.latestInForce} — so these tests exercise the
 * service's orchestration (fetch per layer in order, compose, validate)
 * against the same selection logic every real adapter uses, rather than
 * reimplementing it.
 */
function fakeRepository(
    editions: ReadonlyArray<RulesetLayerEdition>,
): RulesetLayerEditionRepository {
    return {
        async inForce(layerId: RulesetLayerId, date: LocalDate) {
            return RulesetLayerEdition.latestInForce(editions, layerId, date);
        },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveEffectiveRuleset', () => {
    describe('single-layer passthrough', () => {
        it('returns an EffectiveRuleset containing exactly the layer data', async () => {
            const classDef = makeClass('c-1');
            const edition = makeEdition('fci', { classDefinitions: [classDef] });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci')],
                fakeRepository([edition]),
                TEST_DATE,
            );

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]).toEqual(classDef);
        });
    });

    describe('additive merge', () => {
        it('second layer with a new ClassId adds without removing any base-layer class', async () => {
            const base = makeEdition('fci', { classDefinitions: [makeClass('c-1')] });
            const national = makeEdition('srsh', { classDefinitions: [makeClass('c-2')] });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci'), asRulesetLayerId('srsh')],
                fakeRepository([base, national]),
                TEST_DATE,
            );

            const ids = result.classDefinitions.map((c) => c.id);
            expect(ids).toContain(asClassId('c-1'));
            expect(ids).toContain(asClassId('c-2'));
            expect(result.classDefinitions).toHaveLength(2);
        });
    });

    describe('override', () => {
        it('second layer with same ClassId replaces the base-layer ClassDefinition wholly', async () => {
            const base = makeEdition('fci', { classDefinitions: [makeClass('c-1', 9)] });
            const national = makeEdition('srsh', { classDefinitions: [makeClass('c-1', 3)] });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci'), asRulesetLayerId('srsh')],
                fakeRepository([base, national]),
                TEST_DATE,
            );

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]?.fromAgeMonths).toBe(3);
        });
    });

    describe('layer ordering', () => {
        it('last array element wins when two layers share the same ClassId', async () => {
            const layer1 = makeEdition('l1', { classDefinitions: [makeClass('c-1', 9)] });
            const layer2 = makeEdition('l2', { classDefinitions: [makeClass('c-1', 15)] });
            const layer3 = makeEdition('l3', { classDefinitions: [makeClass('c-1', 18)] });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('l1'), asRulesetLayerId('l2'), asRulesetLayerId('l3')],
                fakeRepository([layer1, layer2, layer3]),
                TEST_DATE,
            );

            expect(result.classDefinitions).toHaveLength(1);
            expect(result.classDefinitions[0]?.fromAgeMonths).toBe(18);
        });
    });

    describe('metadata', () => {
        it('carries an id matching the supplied EffectiveRulesetId', async () => {
            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci')],
                fakeRepository([makeEdition('fci')]),
                TEST_DATE,
            );

            expect(result.id).toBe(RULESET_ID);
        });

        it('carries resolvedFor matching the supplied date', async () => {
            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci')],
                fakeRepository([makeEdition('fci')]),
                TEST_DATE,
            );

            expect(result.resolvedFor).toEqual(TEST_DATE);
        });

        it('carries sourceEditions listing every input layer, in order, with its effectiveFrom', async () => {
            const l1 = makeEdition('layer-a', { effectiveFrom: LocalDate.of(2020, 1, 1) });
            const l2 = makeEdition('layer-b', { effectiveFrom: LocalDate.of(2021, 6, 1) });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('layer-a'), asRulesetLayerId('layer-b')],
                fakeRepository([l1, l2]),
                TEST_DATE,
            );

            expect(result.sourceEditions).toEqual([
                { layerId: asRulesetLayerId('layer-a'), effectiveFrom: LocalDate.of(2020, 1, 1) },
                { layerId: asRulesetLayerId('layer-b'), effectiveFrom: LocalDate.of(2021, 6, 1) },
            ]);
        });
    });

    describe('array isolation', () => {
        it('mutating the input classDefinitions array after calling the function does not change the returned snapshot', async () => {
            const mutableDefs: ClassDefinition[] = [makeClass('c-1')];
            const edition = makeEdition('fci', { classDefinitions: mutableDefs });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci')],
                fakeRepository([edition]),
                TEST_DATE,
            );

            // Mutate after resolution
            mutableDefs.push(makeClass('c-extra'));

            expect(result.classDefinitions).toHaveLength(1);
        });
    });

    describe('all collection types are merged', () => {
        it('gradeScales, awardTypes and showTypes also follow last-wins override', async () => {
            const base = makeEdition('fci', {
                gradeScales: [makeGradeScale('gs-1')],
                awardTypes: [makeAwardType('at-1')],
                showTypes: [makeShowType('st-1')],
            });
            const national = makeEdition('srsh', {
                gradeScales: [makeGradeScale('gs-1')],
                awardTypes: [makeAwardType('at-1')],
                showTypes: [makeShowType('st-1')],
            });

            const result = await resolveEffectiveRuleset(
                RULESET_ID,
                [asRulesetLayerId('fci'), asRulesetLayerId('srsh')],
                fakeRepository([base, national]),
                TEST_DATE,
            );

            expect(result.gradeScales).toHaveLength(1);
            expect(result.awardTypes).toHaveLength(1);
            expect(result.showTypes).toHaveLength(1);
        });
    });

    describe('edition selection by date (ADR-0029)', () => {
        const layerId = asRulesetLayerId('fci');
        const early = RulesetLayerEdition.of({
            layerId,
            effectiveFrom: LocalDate.of(2026, 1, 1),
            classDefinitions: [makeClass('open', 15)],
            gradeScales: [makeGradeScale('gs-standard')],
            awardTypes: [],
            showTypes: [],
        });
        const later = RulesetLayerEdition.of({
            layerId,
            effectiveFrom: LocalDate.of(2027, 1, 1),
            classDefinitions: [makeClass('open', 15), makeClass('bred-by-exhibitor', 15)],
            gradeScales: [makeGradeScale('gs-standard')],
            awardTypes: [],
            showTypes: [],
        });
        const repository = fakeRepository([early, later]);

        it('resolves two different EffectiveRulesets for show dates either side of the edition boundary', async () => {
            const before = await resolveEffectiveRuleset(
                RULESET_ID,
                [layerId],
                repository,
                LocalDate.of(2026, 12, 31),
            );
            const after = await resolveEffectiveRuleset(
                RULESET_ID,
                [layerId],
                repository,
                LocalDate.of(2027, 1, 1),
            );

            expect(before.classDefinitions).toHaveLength(1);
            expect(before.classDefinitions.map((c) => c.id)).not.toContain(
                asClassId('bred-by-exhibitor'),
            );
            expect(after.classDefinitions).toHaveLength(2);
            expect(after.classDefinitions.map((c) => c.id)).toContain(
                asClassId('bred-by-exhibitor'),
            );
        });

        it('records the selected edition in sourceEditions', async () => {
            const after = await resolveEffectiveRuleset(
                RULESET_ID,
                [layerId],
                repository,
                LocalDate.of(2027, 6, 1),
            );

            expect(after.sourceEditions).toEqual([
                { layerId, effectiveFrom: LocalDate.of(2027, 1, 1) },
            ]);
        });

        it('throws NoEditionInForceError when no edition of a layer is in force yet on the show date', async () => {
            await expect(
                resolveEffectiveRuleset(
                    RULESET_ID,
                    [layerId],
                    repository,
                    LocalDate.of(2025, 12, 31),
                ),
            ).rejects.toThrow(NoEditionInForceError);
        });
    });
});
