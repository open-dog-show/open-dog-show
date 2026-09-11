// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { EffectiveRuleset } from '../../../../../src/rulesets/domain/model/effective-ruleset/effective-ruleset.js';
import { RulesetLayer } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/ruleset-layer.js';
import {
    GradeScale,
    Grade,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import {
    asRulesetLayerId,
    asGradeScaleId,
    asGradeId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';

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
        const resolvedAt = LocalDate.of(2026, 1, 1);

        const ruleset = EffectiveRuleset.resolve([layer], resolvedAt);

        expect(ruleset).toBeInstanceOf(EffectiveRuleset);
        expect(ruleset.resolvedAt).toEqual(resolvedAt);
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

        const ruleset = EffectiveRuleset.resolve([layer], LocalDate.of(2026, 1, 1));
        grades.push(Grade.of(asGradeId('very-good'), 1));

        expect(ruleset.gradeScales[0]?.grades).toHaveLength(1);
    });

    it('is nominal — a structural object literal is not assignable to EffectiveRuleset', () => {
        // The private #brand field closes the structural-literal leak: a bare
        // { resolvedAt, sourceLayerIds, ... } is not assignable to the class
        // (mirrors RoleGrant/User/Entry).
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notARuleset: EffectiveRuleset = {
            resolvedAt: LocalDate.of(2026, 1, 1),
            sourceLayerIds: [],
            classDefinitions: [],
            gradeScales: [],
            awardTypes: [],
            showTypes: [],
        };
        expect(notARuleset).toBeDefined();
    });
});
