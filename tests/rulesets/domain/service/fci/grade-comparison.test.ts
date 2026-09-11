// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    gradeAtLeast,
    resolveGrade,
    resolveGradePairOnSharedScale,
} from '../../../../../src/rulesets/domain/service/fci/grade-comparison.js';
import {
    asGradeId,
    asGradeScaleId,
    asRulesetLayerId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import {
    Grade,
    GradeScale,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import { RulesetLayer } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/ruleset-layer.js';
import { EffectiveRuleset } from '../../../../../src/rulesets/domain/model/effective-ruleset/effective-ruleset.js';

const EXCELLENT = asGradeId('excellent');
const VERY_GOOD = asGradeId('very-good');
const VERY_PROMISING = asGradeId('very-promising');
const ADULT_SCALE_ID = asGradeScaleId('adult');
const PUPPY_SCALE_ID = asGradeScaleId('puppy');

function grade(id: string, ordinal: number): Grade {
    return Grade.of(asGradeId(id), ordinal);
}

function scale(id: string, ...grades: Grade[]): GradeScale {
    return GradeScale.of({
        id: asGradeScaleId(id),
        grades,
        placeableThresholdId: grades[0]?.id ?? asGradeId('placeholder'),
        specialOutcomes: [],
    });
}

function ruleset(...scales: GradeScale[]): EffectiveRuleset {
    const layer = RulesetLayer.of({
        id: asRulesetLayerId('test'),
        parentLayerId: undefined,
        classDefinitions: [],
        gradeScales: scales,
        awardTypes: [],
        showTypes: [],
    });
    return EffectiveRuleset.resolve([layer], LocalDate.of(2026, 1, 1));
}

describe('gradeAtLeast', () => {
    it('a lower ordinal is at least as good as a higher one (better grade)', () => {
        expect(gradeAtLeast(grade('excellent', 0), grade('very-good', 1))).toBe(true);
    });

    it('equal ordinals are at least as good', () => {
        expect(gradeAtLeast(grade('excellent', 0), grade('excellent', 0))).toBe(true);
    });

    it('a higher ordinal is not at least as good as a lower one (worse grade)', () => {
        expect(gradeAtLeast(grade('very-good', 1), grade('excellent', 0))).toBe(false);
    });
});

describe('resolveGrade', () => {
    const RULESET = ruleset(scale('adult', grade('excellent', 0), grade('very-good', 1)));

    it('resolves a grade on the named scale', () => {
        expect(resolveGrade(EXCELLENT, ADULT_SCALE_ID, RULESET)?.ordinal).toBe(0);
    });

    it('returns undefined when the grade is not on the named scale', () => {
        expect(resolveGrade(VERY_PROMISING, ADULT_SCALE_ID, RULESET)).toBeUndefined();
    });

    it('returns undefined when the named scale does not exist', () => {
        expect(resolveGrade(EXCELLENT, asGradeScaleId('missing'), RULESET)).toBeUndefined();
    });

    it('returns undefined for an undefined gradeId', () => {
        expect(resolveGrade(undefined, ADULT_SCALE_ID, RULESET)).toBeUndefined();
    });
});

describe('resolveGradePairOnSharedScale', () => {
    const RULESET = ruleset(
        scale('adult', grade('excellent', 0), grade('very-good', 1)),
        scale('puppy', grade('very-promising', 0)),
    );

    it('resolves both grades when they share a scale', () => {
        const pair = resolveGradePairOnSharedScale(EXCELLENT, VERY_GOOD, RULESET);
        expect(pair?.candidate.ordinal).toBe(0);
        expect(pair?.minimum.ordinal).toBe(1);
    });

    it('returns undefined when the two grades live on different scales (ordinals not comparable)', () => {
        // EXCELLENT is on the adult scale, VERY_PROMISING on the puppy scale —
        // their ordinals cannot be compared, so the helper refuses to pair them.
        expect(resolveGradePairOnSharedScale(EXCELLENT, VERY_PROMISING, RULESET)).toBeUndefined();
    });

    it('returns undefined when one grade is unknown on any scale', () => {
        expect(
            resolveGradePairOnSharedScale(EXCELLENT, asGradeId('nope'), RULESET),
        ).toBeUndefined();
    });

    it('returns undefined when there are no grade scales', () => {
        expect(resolveGradePairOnSharedScale(EXCELLENT, VERY_GOOD, ruleset())).toBeUndefined();
    });

    it('ignores PUPPY_SCALE_ID (kept for clarity, unused by these grades)', () => {
        // Sanity: the puppy scale id is a distinct scale, not the adult one.
        expect(PUPPY_SCALE_ID).not.toBe(ADULT_SCALE_ID);
    });
});
