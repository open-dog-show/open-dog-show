// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { GradeId, GradeScaleId } from '../../shared/domain-ids.js';
import type { EffectiveRuleset } from '../../model/effective-ruleset/effective-ruleset.js';
import type { Grade } from '../../model/effective-ruleset/entities/grade-scale.js';

/**
 * Returns the {@link Grade} for `gradeId` within the named `gradeScaleId`, or
 * `undefined` when either the scale or the grade cannot be found.
 *
 * Used where the scale is known at the call site (a dog's grade is resolved on
 * its class's grade scale — see {@link meetsAwardRequirements}).
 */
export function resolveGrade(
    gradeId: GradeId,
    gradeScaleId: GradeScaleId,
    ruleset: EffectiveRuleset,
): Grade | undefined {
    return ruleset.gradeScale(gradeScaleId)?.grade(gradeId);
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
        const candidate = scale.grade(candidateGradeId);
        const minimum = scale.grade(minimumGradeId);
        if (candidate && minimum) {
            return { candidate, minimum };
        }
    }
    return undefined;
}
