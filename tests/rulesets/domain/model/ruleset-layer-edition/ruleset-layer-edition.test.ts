// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { RulesetLayerEdition } from '../../../../../src/rulesets/domain/model/ruleset-layer-edition/ruleset-layer-edition.js';
import { asRulesetLayerId } from '../../../../../src/rulesets/domain/shared/domain-ids.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import { ClassDefinition } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/class-definition.js';
import { asClassId, asGradeScaleId } from '../../../../../src/rulesets/domain/shared/domain-ids.js';

const FCI = asRulesetLayerId('fci');
const KMSH = asRulesetLayerId('kmsh');

function edition(layerId = FCI, effectiveFrom = LocalDate.of(2026, 1, 1)): RulesetLayerEdition {
    return RulesetLayerEdition.of({
        layerId,
        effectiveFrom,
        classDefinitions: [],
        gradeScales: [],
        awardTypes: [],
        showTypes: [],
    });
}

describe('RulesetLayerEdition', () => {
    describe('of', () => {
        it('exposes the supplied attributes', () => {
            const classDef = ClassDefinition.of({
                id: asClassId('open'),
                fromAgeMonths: undefined,
                lessThanAgeMonths: undefined,
                requiredCertificates: [],
                bredByExhibitor: false,
                gradeScaleId: asGradeScaleId('gs-1'),
                awardTypeIds: [],
            });
            const effectiveFrom = LocalDate.of(2027, 1, 1);

            const result = RulesetLayerEdition.of({
                layerId: FCI,
                effectiveFrom,
                classDefinitions: [classDef],
                gradeScales: [],
                awardTypes: [],
                showTypes: [],
            });

            expect(result.layerId).toBe(FCI);
            expect(result.effectiveFrom).toBe(effectiveFrom);
            expect(result.classDefinitions).toEqual([classDef]);
        });

        it('detaches the collections from the caller-owned input arrays', () => {
            const mutableDefs: ClassDefinition[] = [];
            const result = RulesetLayerEdition.of({
                layerId: FCI,
                effectiveFrom: LocalDate.of(2026, 1, 1),
                classDefinitions: mutableDefs,
                gradeScales: [],
                awardTypes: [],
                showTypes: [],
            });

            mutableDefs.push(
                ClassDefinition.of({
                    id: asClassId('open'),
                    fromAgeMonths: undefined,
                    lessThanAgeMonths: undefined,
                    requiredCertificates: [],
                    bredByExhibitor: false,
                    gradeScaleId: asGradeScaleId('gs-1'),
                    awardTypeIds: [],
                }),
            );

            expect(result.classDefinitions).toHaveLength(0);
        });

        it('is nominal — a structural object literal is not assignable to RulesetLayerEdition', () => {
            // The private #brand field closes the structural-literal leak: a bare
            // { layerId, effectiveFrom, ... } is not assignable to the class
            // (mirrors EffectiveRuleset/Item).
            // @ts-expect-error — Property '#brand' is missing in the object literal.
            const notAnEdition: RulesetLayerEdition = {
                layerId: FCI,
                effectiveFrom: LocalDate.of(2026, 1, 1),
                classDefinitions: [],
                gradeScales: [],
                awardTypes: [],
                showTypes: [],
            };
            expect(notAnEdition).toBeDefined();
        });
    });

    describe('latestInForce', () => {
        it('returns undefined when no edition of the layer exists', () => {
            const result = RulesetLayerEdition.latestInForce(
                [edition(FCI, LocalDate.of(2026, 1, 1))],
                KMSH,
                LocalDate.of(2026, 6, 1),
            );

            expect(result).toBeUndefined();
        });

        it('returns undefined when the only edition is not yet in force on the date', () => {
            const result = RulesetLayerEdition.latestInForce(
                [edition(FCI, LocalDate.of(2027, 1, 1))],
                FCI,
                LocalDate.of(2026, 12, 31),
            );

            expect(result).toBeUndefined();
        });

        it('returns the edition when its effectiveFrom equals the date exactly', () => {
            const e = edition(FCI, LocalDate.of(2027, 1, 1));

            const result = RulesetLayerEdition.latestInForce([e], FCI, LocalDate.of(2027, 1, 1));

            expect(result).toBe(e);
        });

        it('returns the latest of several qualifying editions, not just the first', () => {
            const early = edition(FCI, LocalDate.of(2020, 1, 1));
            const mid = edition(FCI, LocalDate.of(2026, 1, 1));
            const late = edition(FCI, LocalDate.of(2027, 1, 1));

            const result = RulesetLayerEdition.latestInForce(
                [early, late, mid],
                FCI,
                LocalDate.of(2027, 6, 1),
            );

            expect(result).toBe(late);
        });

        it('ignores editions of other layers', () => {
            const fciEdition = edition(FCI, LocalDate.of(2026, 1, 1));
            const kmshEdition = edition(KMSH, LocalDate.of(2028, 1, 1));

            const result = RulesetLayerEdition.latestInForce(
                [fciEdition, kmshEdition],
                FCI,
                LocalDate.of(2029, 1, 1),
            );

            expect(result).toBe(fciEdition);
        });

        it('picks the latest edition still on or before the date, not one published later', () => {
            const early = edition(FCI, LocalDate.of(2026, 1, 1));
            const late = edition(FCI, LocalDate.of(2027, 1, 1));

            const result = RulesetLayerEdition.latestInForce(
                [early, late],
                FCI,
                LocalDate.of(2026, 6, 1),
            );

            expect(result).toBe(early);
        });
    });
});
