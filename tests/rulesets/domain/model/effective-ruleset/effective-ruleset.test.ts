// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    EffectiveRuleset,
    UnknownGradeScaleReferenceError,
    UnknownAwardTypeReferenceError,
    UnknownMinimumGradeReferenceError,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/effective-ruleset.js';
import { RulesetLayer } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/ruleset-layer.js';
import {
    GradeScale,
    Grade,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import { ClassDefinition } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/class-definition.js';
import {
    PerSexAwardType,
    CollectiveAwardType,
    HigherScopeAwardType,
    AwardFeeder,
    ClassFeeder,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import {
    asRulesetLayerId,
    asGradeScaleId,
    asGradeId,
    asClassId,
    asAwardTypeId,
    asEffectiveRulesetId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { asAgeMonths } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';

const RULESET_ID = asEffectiveRulesetId('ruleset-1');

describe('EffectiveRuleset', () => {
    it('resolve composes an empty layer set into an empty snapshot', () => {
        const layer = RulesetLayer.of({
            id: asRulesetLayerId('test'),
            parentLayerId: undefined,
            classDefinitions: [],
            gradeScales: [],
            awardTypes: [],
            showTypes: [],
        });
        const resolvedFor = LocalDate.of(2026, 1, 1);

        const ruleset = EffectiveRuleset.resolve(RULESET_ID, [layer], resolvedFor);

        expect(ruleset).toBeInstanceOf(EffectiveRuleset);
        expect(ruleset.id).toBe(RULESET_ID);
        expect(ruleset.resolvedFor).toEqual(resolvedFor);
        expect(ruleset.sourceLayerIds).toEqual([asRulesetLayerId('test')]);
        expect(ruleset.classDefinitions).toHaveLength(0);
    });

    it('mutating the caller-owned grades array after resolution does not mutate the snapshot', () => {
        const grades = [Grade.of(asGradeId('excellent'), 0)];
        const gradeScale = GradeScale.of({
            id: asGradeScaleId('gs-1'),
            grades,
            placeableThresholdId: asGradeId('excellent'),
            specialOutcomes: [],
        });
        const layer = RulesetLayer.of({
            id: asRulesetLayerId('test'),
            parentLayerId: undefined,
            classDefinitions: [],
            gradeScales: [gradeScale],
            awardTypes: [],
            showTypes: [],
        });

        const ruleset = EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1));
        grades.push(Grade.of(asGradeId('very-good'), 1));

        expect(ruleset.gradeScales[0]?.grades).toHaveLength(1);
    });

    it('is nominal — a structural object literal is not assignable to EffectiveRuleset', () => {
        // The private #brand field closes the structural-literal leak: a bare
        // { id, resolvedFor, sourceLayerIds, ... } is not assignable to the
        // class (mirrors RoleGrant/User/Entry).
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notARuleset: EffectiveRuleset = {
            id: RULESET_ID,
            resolvedFor: LocalDate.of(2026, 1, 1),
            sourceLayerIds: [],
            classDefinitions: [],
            gradeScales: [],
            awardTypes: [],
            showTypes: [],
        };
        expect(notARuleset).toBeDefined();
    });

    describe('reference validation (ADR-0029)', () => {
        const gradeScaleId = asGradeScaleId('gs-1');
        const excellent = asGradeId('excellent');
        const gradeScale = GradeScale.of({
            id: gradeScaleId,
            grades: [Grade.of(excellent, 0)],
            placeableThresholdId: excellent,
            specialOutcomes: [],
        });
        const cacibId = asAwardTypeId('cacib');
        const cacib = PerSexAwardType.of({
            id: cacibId,
            minimumGradeId: excellent,
            worstEligiblePlacement: undefined,
            isDiscretionary: true,
        });

        it('rejects a ClassDefinition referencing an unknown grade scale', () => {
            const classDef = ClassDefinition.of({
                id: asClassId('open'),
                fromAgeMonths: asAgeMonths(15),
                lessThanAgeMonths: undefined,
                requiredCertificates: [],
                bredByExhibitor: false,
                gradeScaleId: asGradeScaleId('missing-scale'),
                awardTypeIds: [],
            });
            const layer = RulesetLayer.of({
                id: asRulesetLayerId('test'),
                parentLayerId: undefined,
                classDefinitions: [classDef],
                gradeScales: [],
                awardTypes: [],
                showTypes: [],
            });

            expect(() =>
                EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1)),
            ).toThrow(UnknownGradeScaleReferenceError);
        });

        it('rejects a ClassDefinition referencing an unknown award type', () => {
            const classDef = ClassDefinition.of({
                id: asClassId('open'),
                fromAgeMonths: asAgeMonths(15),
                lessThanAgeMonths: undefined,
                requiredCertificates: [],
                bredByExhibitor: false,
                gradeScaleId,
                awardTypeIds: [asAwardTypeId('missing-award')],
            });
            const layer = RulesetLayer.of({
                id: asRulesetLayerId('test'),
                parentLayerId: undefined,
                classDefinitions: [classDef],
                gradeScales: [gradeScale],
                awardTypes: [],
                showTypes: [],
            });

            expect(() =>
                EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1)),
            ).toThrow(UnknownAwardTypeReferenceError);
        });

        it('rejects an award type whose minimumGradeId does not resolve on the scale it is used with', () => {
            const awardWithUnknownMinGrade = PerSexAwardType.of({
                id: cacibId,
                minimumGradeId: asGradeId('does-not-exist'),
                worstEligiblePlacement: undefined,
                isDiscretionary: true,
            });
            const classDef = ClassDefinition.of({
                id: asClassId('open'),
                fromAgeMonths: asAgeMonths(15),
                lessThanAgeMonths: undefined,
                requiredCertificates: [],
                bredByExhibitor: false,
                gradeScaleId,
                awardTypeIds: [cacibId],
            });
            const layer = RulesetLayer.of({
                id: asRulesetLayerId('test'),
                parentLayerId: undefined,
                classDefinitions: [classDef],
                gradeScales: [gradeScale],
                awardTypes: [awardWithUnknownMinGrade],
                showTypes: [],
            });

            expect(() =>
                EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1)),
            ).toThrow(UnknownMinimumGradeReferenceError);
        });

        it('accepts a fully self-consistent ruleset', () => {
            const classDef = ClassDefinition.of({
                id: asClassId('open'),
                fromAgeMonths: asAgeMonths(15),
                lessThanAgeMonths: undefined,
                requiredCertificates: [],
                bredByExhibitor: false,
                gradeScaleId,
                awardTypeIds: [cacibId],
            });
            const layer = RulesetLayer.of({
                id: asRulesetLayerId('test'),
                parentLayerId: undefined,
                classDefinitions: [classDef],
                gradeScales: [gradeScale],
                awardTypes: [cacib],
                showTypes: [],
            });

            const ruleset = EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1));

            expect(ruleset.classDefinitions).toHaveLength(1);
        });

        it('accepts a class referencing a collective award type (no minimumGradeId to check)', () => {
            const braceId = asAwardTypeId('best-brace');
            const brace = CollectiveAwardType.of({ id: braceId, isDiscretionary: false });
            const classDef = ClassDefinition.of({
                id: asClassId('open'),
                fromAgeMonths: asAgeMonths(15),
                lessThanAgeMonths: undefined,
                requiredCertificates: [],
                bredByExhibitor: false,
                gradeScaleId,
                awardTypeIds: [braceId],
            });
            const layer = RulesetLayer.of({
                id: asRulesetLayerId('test'),
                parentLayerId: undefined,
                classDefinitions: [classDef],
                gradeScales: [gradeScale],
                awardTypes: [brace],
                showTypes: [],
            });

            const ruleset = EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1));

            expect(ruleset.classDefinitions).toHaveLength(1);
        });

        describe('higher-scope award types (fedBy feeder graph)', () => {
            it('rejects a higher-scope award whose minimumGradeId does not resolve on any class-feeder scale', () => {
                const classDef = ClassDefinition.of({
                    id: asClassId('junior'),
                    fromAgeMonths: undefined,
                    lessThanAgeMonths: undefined,
                    requiredCertificates: [],
                    bredByExhibitor: false,
                    gradeScaleId,
                    awardTypeIds: [],
                });
                const bestJunior = HigherScopeAwardType.show({
                    id: asAwardTypeId('best-junior'),
                    minimumGradeId: asGradeId('does-not-exist'),
                    worstEligiblePlacement: undefined,
                    isDiscretionary: false,
                    fedBy: [ClassFeeder.of(asClassId('junior'))],
                });
                const layer = RulesetLayer.of({
                    id: asRulesetLayerId('test'),
                    parentLayerId: undefined,
                    classDefinitions: [classDef],
                    gradeScales: [gradeScale],
                    awardTypes: [bestJunior],
                    showTypes: [],
                });

                expect(() =>
                    EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1)),
                ).toThrow(UnknownMinimumGradeReferenceError);
            });

            it('rejects a higher-scope award whose minimumGradeId does not resolve on any award-feeder scale, reached through a per-sex award', () => {
                const classDef = ClassDefinition.of({
                    id: asClassId('open'),
                    fromAgeMonths: asAgeMonths(15),
                    lessThanAgeMonths: undefined,
                    requiredCertificates: [],
                    bredByExhibitor: false,
                    gradeScaleId,
                    awardTypeIds: [cacibId],
                });
                const bob = HigherScopeAwardType.breed({
                    id: asAwardTypeId('bob'),
                    minimumGradeId: asGradeId('does-not-exist'),
                    worstEligiblePlacement: undefined,
                    isDiscretionary: false,
                    fedBy: [AwardFeeder.of(cacibId)],
                });
                const layer = RulesetLayer.of({
                    id: asRulesetLayerId('test'),
                    parentLayerId: undefined,
                    classDefinitions: [classDef],
                    gradeScales: [gradeScale],
                    awardTypes: [cacib, bob],
                    showTypes: [],
                });

                expect(() =>
                    EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1)),
                ).toThrow(UnknownMinimumGradeReferenceError);
            });

            it('accepts a higher-scope award whose minimumGradeId resolves through a two-hop feeder chain (award feeds award feeds award)', () => {
                const classDef = ClassDefinition.of({
                    id: asClassId('open'),
                    fromAgeMonths: asAgeMonths(15),
                    lessThanAgeMonths: undefined,
                    requiredCertificates: [],
                    bredByExhibitor: false,
                    gradeScaleId,
                    awardTypeIds: [cacibId],
                });
                const bobId = asAwardTypeId('bob');
                const bob = HigherScopeAwardType.breed({
                    id: bobId,
                    minimumGradeId: excellent,
                    worstEligiblePlacement: undefined,
                    isDiscretionary: false,
                    fedBy: [AwardFeeder.of(cacibId)],
                });
                const big = HigherScopeAwardType.group({
                    id: asAwardTypeId('big'),
                    minimumGradeId: excellent,
                    worstEligiblePlacement: undefined,
                    isDiscretionary: false,
                    fedBy: [AwardFeeder.of(bobId)],
                });
                const layer = RulesetLayer.of({
                    id: asRulesetLayerId('test'),
                    parentLayerId: undefined,
                    classDefinitions: [classDef],
                    gradeScales: [gradeScale],
                    awardTypes: [cacib, bob, big],
                    showTypes: [],
                });

                const ruleset = EffectiveRuleset.resolve(
                    RULESET_ID,
                    [layer],
                    LocalDate.of(2026, 1, 1),
                );

                expect(ruleset.awardTypes).toHaveLength(3);
            });

            it('skips validation for a higher-scope award whose feeder graph reaches no class (nothing to check against)', () => {
                const orphanBob = HigherScopeAwardType.breed({
                    id: asAwardTypeId('bob'),
                    minimumGradeId: asGradeId('does-not-exist'),
                    worstEligiblePlacement: undefined,
                    isDiscretionary: false,
                    fedBy: [AwardFeeder.of(asAwardTypeId('unknown-feeder'))],
                });
                const layer = RulesetLayer.of({
                    id: asRulesetLayerId('test'),
                    parentLayerId: undefined,
                    classDefinitions: [],
                    gradeScales: [],
                    awardTypes: [orphanBob],
                    showTypes: [],
                });

                const ruleset = EffectiveRuleset.resolve(
                    RULESET_ID,
                    [layer],
                    LocalDate.of(2026, 1, 1),
                );

                expect(ruleset.awardTypes).toHaveLength(1);
            });
        });
    });

    describe('awardType / classDefinition / gradeScale / higherScopeAwardTypes lookups', () => {
        const classDef = ClassDefinition.of({
            id: asClassId('open'),
            fromAgeMonths: asAgeMonths(15),
            lessThanAgeMonths: undefined,
            requiredCertificates: [],
            bredByExhibitor: false,
            gradeScaleId: asGradeScaleId('gs-1'),
            awardTypeIds: [asAwardTypeId('cacib')],
        });
        const gradeScale = GradeScale.of({
            id: asGradeScaleId('gs-1'),
            grades: [Grade.of(asGradeId('excellent'), 0)],
            placeableThresholdId: asGradeId('excellent'),
            specialOutcomes: [],
        });
        const cacib = PerSexAwardType.of({
            id: asAwardTypeId('cacib'),
            minimumGradeId: asGradeId('excellent'),
            worstEligiblePlacement: undefined,
            isDiscretionary: true,
        });
        const layer = RulesetLayer.of({
            id: asRulesetLayerId('test'),
            parentLayerId: undefined,
            classDefinitions: [classDef],
            gradeScales: [gradeScale],
            awardTypes: [cacib],
            showTypes: [],
        });
        const ruleset = EffectiveRuleset.resolve(RULESET_ID, [layer], LocalDate.of(2026, 1, 1));

        it('awardType returns the matching award, or undefined when absent', () => {
            expect(ruleset.awardType(asAwardTypeId('cacib'))).toBe(cacib);
            expect(ruleset.awardType(asAwardTypeId('missing'))).toBeUndefined();
        });

        it('classDefinition returns the matching class, or undefined when absent', () => {
            expect(ruleset.classDefinition(asClassId('open'))).toBe(classDef);
            expect(ruleset.classDefinition(asClassId('missing'))).toBeUndefined();
        });

        it('gradeScale returns the matching scale, or undefined when absent', () => {
            expect(ruleset.gradeScale(asGradeScaleId('gs-1'))).toBe(gradeScale);
            expect(ruleset.gradeScale(asGradeScaleId('missing'))).toBeUndefined();
        });

        it('higherScopeAwardTypes filters a mixed set to only the matching scope kind', () => {
            const bob = HigherScopeAwardType.breed({
                id: asAwardTypeId('bob'),
                minimumGradeId: asGradeId('excellent'),
                worstEligiblePlacement: undefined,
                isDiscretionary: false,
                fedBy: [AwardFeeder.of(asAwardTypeId('cacib'))],
            });
            const big = HigherScopeAwardType.group({
                id: asAwardTypeId('big'),
                minimumGradeId: asGradeId('excellent'),
                worstEligiblePlacement: undefined,
                isDiscretionary: false,
                fedBy: [AwardFeeder.of(asAwardTypeId('bob'))],
            });
            const mixedLayer = RulesetLayer.of({
                id: asRulesetLayerId('mixed'),
                parentLayerId: undefined,
                classDefinitions: [],
                gradeScales: [],
                awardTypes: [cacib, bob, big],
                showTypes: [],
            });
            const mixedRuleset = EffectiveRuleset.resolve(
                RULESET_ID,
                [mixedLayer],
                LocalDate.of(2026, 1, 1),
            );

            expect(mixedRuleset.higherScopeAwardTypes('breed')).toEqual([bob]);
            expect(mixedRuleset.higherScopeAwardTypes('group')).toEqual([big]);
            expect(mixedRuleset.higherScopeAwardTypes('show')).toHaveLength(0);
        });
    });
});
