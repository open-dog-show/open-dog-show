// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
    GradeId,
    GradeScaleId,
} from '../../model/effective-ruleset/value-objects/domain-ids.js';
import type { EffectiveRuleset } from '../../model/effective-ruleset/effective-ruleset.js';
import { findGrade } from '../../model/effective-ruleset/effective-ruleset.js';
import type { Grade } from '../../model/effective-ruleset/entities/grade-scale.js';

/**
 * Returns `true` when `actual` is at least as good as `minimum`.
 * Lower ordinal = better grade (Excellent = 0, Very Good = 1, …).
 *
 * Shared by the per-sex requirement check ({@link meetsAwardRequirements}) and
 * the higher-scope candidate check (`FciAwardPolicy.candidateMeetsMinimumGrade`)
 * so the ordinal-comparison rule lives in one place.
 */
export function gradeAtLeast(actual: Grade, minimum: Grade): boolean {
    return actual.ordinal <= minimum.ordinal;
}

/**
 * Returns the {@link Grade} for `gradeId` within the named `gradeScaleId`, or
 * `undefined` when either the scale or the grade cannot be found.
 *
 * Used where the scale is known at the call site (a dog's grade is resolved on
 * its class's grade scale — see {@link meetsAwardRequirements}).
 */
export function resolveGrade(
    gradeId: GradeId | undefined,
    gradeScaleId: GradeScaleId,
    ruleset: EffectiveRuleset,
): Grade | undefined {
    if (gradeId === undefined) return undefined;
    return findGrade(ruleset, gradeScaleId, gradeId);
}

/**
 * Resolves two grade ids on the *single* scale that contains them both, so
 * their ordinals are comparable. Returns `undefined` when no shared scale
 * exists (the grades live on different scales, or one/both are unknown).
 *
 * Used where the scale is not known at the call site (a higher-scope award's
 * `minimumGradeId` is not tied to a single class scale — see
 * `FciAwardPolicy.candidateMeetsMinimumGrade`).
 */
export function resolveGradePairOnSharedScale(
    candidateGradeId: GradeId,
    minimumGradeId: GradeId,
    ruleset: EffectiveRuleset,
): { readonly candidate: Grade; readonly minimum: Grade } | undefined {
    for (const scale of ruleset.gradeScales) {
        const candidate = scale.grades.find((g) => g.id === candidateGradeId);
        const minimum = scale.grades.find((g) => g.id === minimumGradeId);
        if (candidate && minimum) {
            return { candidate, minimum };
        }
    }
    return undefined;
}
