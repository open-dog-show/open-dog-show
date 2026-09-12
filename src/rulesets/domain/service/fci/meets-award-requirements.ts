// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IndividualAwardType } from '../../model/effective-ruleset/entities/award-type.js';
import type { ClassDefinition } from '../../model/effective-ruleset/entities/class-definition.js';
import type { EffectiveRuleset } from '../../model/effective-ruleset/effective-ruleset.js';
import type { ClassPlacement } from '../../model/effective-ruleset/value-objects/judging-scope-results.js';
import { resolveGrade } from './grade-comparison.js';

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
 * `worstEligiblePlacement` means no placement restriction applies.
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

    // EffectiveRuleset.resolve's validating factory guarantees every award
    // type's minimumGradeId resolves on the scale it is used with (ADR-0029),
    // so no compensating "unknown minimum grade" check is needed here.
    const minGrade = resolveGrade(awardType.minimumGradeId, classDef.gradeScaleId, ruleset)!;

    if (!dogGrade.isAtLeast(minGrade)) {
        return {
            meets: false,
            reason: `Dog '${placement.entryRef}' received grade '${placement.gradeId}' but '${awardType.id}' requires at least '${awardType.minimumGradeId}'`,
        };
    }

    if (
        awardType.worstEligiblePlacement !== undefined &&
        (placement.placement === undefined ||
            placement.placement > awardType.worstEligiblePlacement)
    ) {
        return {
            meets: false,
            reason: `Dog '${placement.entryRef}' has placement ${String(placement.placement)} but '${awardType.id}' requires placement ${String(awardType.worstEligiblePlacement)} or better`,
        };
    }

    return { meets: true };
}
