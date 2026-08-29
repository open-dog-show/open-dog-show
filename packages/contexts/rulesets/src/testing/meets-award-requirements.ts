// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { GradeId, GradeScaleId } from '../domain/domain-ids.js';
import type { IndividualAwardType } from '../domain/award-type.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { EffectiveRuleset } from '../domain/effective-ruleset.js';
import type { Grade } from '../domain/grade-scale.js';
import type { ClassPlacement } from '../domain/judging-scope-results.js';

/**
 * The outcome of checking a single dog's placement against an
 * {@link IndividualAwardType}'s minimum-grade and minimum-placement
 * requirements within its class's {@link ClassDefinition}.
 *
 * - `{ meets: true }` — the dog satisfies every requirement.
 * - `{ meets: false, reason }` — the first unmet requirement, with a
 *   human-readable reason matching the {@link AwardPolicy} contract.
 */
export type AwardRequirementCheck =
    { readonly meets: true } | { readonly meets: false; readonly reason: string };

/**
 * Checks whether `placement` satisfies `awardType`'s minimum-grade and
 * minimum-placement requirements, resolving both grades against the grade
 * scale of `classDef`.
 *
 * This is the single source of truth for the "resolve grade in class scale →
 * grade at least minimum → placement at least minimum" check shared by
 * `FciAwardPolicy.perSexEligible` and `FciAwardPolicy.validatePerSex`. Both
 * grade and placement requirements are optional only insofar as the ruleset
 * defines them: a missing grade is a failure, while an undefined
 * `minimumPlacement` means no placement restriction applies.
 */
export function meetsAwardRequirements(
    placement: ClassPlacement,
    awardType: IndividualAwardType,
    classDef: ClassDefinition,
    ruleset: EffectiveRuleset,
): AwardRequirementCheck {
    const dogGrade = resolveGrade(placement.gradeId, classDef.gradeScaleId, ruleset);
    if (!dogGrade) {
        return {
            meets: false,
            reason: `Unknown grade '${placement.gradeId}' in grade scale '${classDef.gradeScaleId}'`,
        };
    }

    const minGrade = resolveGrade(awardType.minimumGradeId, classDef.gradeScaleId, ruleset);
    if (!minGrade) {
        return {
            meets: false,
            reason: `Award type '${awardType.id}' references unknown minimum grade '${awardType.minimumGradeId}'`,
        };
    }

    if (!gradeAtLeast(dogGrade, minGrade)) {
        return {
            meets: false,
            reason: `Dog '${placement.dogRef}' received grade '${placement.gradeId}' but '${awardType.id}' requires at least '${awardType.minimumGradeId}'`,
        };
    }

    if (
        awardType.minimumPlacement !== undefined &&
        (placement.placement === undefined || placement.placement > awardType.minimumPlacement)
    ) {
        return {
            meets: false,
            reason: `Dog '${placement.dogRef}' has placement ${String(placement.placement)} but '${awardType.id}' requires placement ${String(awardType.minimumPlacement)} or better`,
        };
    }

    return { meets: true };
}

/**
 * Returns the {@link Grade} for `gradeId` within the given grade scale,
 * or `undefined` when either the scale or the grade cannot be found.
 */
function resolveGrade(
    gradeId: GradeId | undefined,
    gradeScaleId: GradeScaleId,
    ruleset: EffectiveRuleset,
): Grade | undefined {
    if (gradeId === undefined) return undefined;
    return ruleset.gradeScales
        .find((gs) => gs.id === gradeScaleId)
        ?.grades.find((g) => g.id === gradeId);
}

/**
 * Returns `true` when `actual` is at least as good as `minimum`.
 * Lower ordinal = better grade (Excellent = 0, Very Good = 1, …).
 */
function gradeAtLeast(actual: Grade, minimum: Grade): boolean {
    return actual.ordinal <= minimum.ordinal;
}
