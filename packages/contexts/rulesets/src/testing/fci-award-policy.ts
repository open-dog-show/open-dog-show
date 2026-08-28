// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId } from '../domain/domain-ids.js';
import type { IndividualAwardType } from '../domain/award-type.js';
import type { EffectiveRuleset } from '../domain/effective-ruleset.js';
import type {
    AwardPolicy,
    AwardValidationResult,
    ProposedAwardAssignment,
} from '../domain/award-policy.js';
import type {
    CandidateEntry,
    ClassPlacement,
    JudgingScopeResults,
} from '../domain/judging-scope-results.js';
import { meetsAwardRequirements } from './meets-award-requirements.js';

/**
 * In-memory FCI implementation of {@link AwardPolicy}.
 *
 * **per-sex scope** — `eligibleAwardTypes` returns an Award Type ID when at
 * least one dog in the scope satisfies the AwardType's minimumGradeId and
 * minimumPlacement requirements within a class that feeds that award type
 * (via `ClassDefinition.awardTypeIds`).
 *
 * **breed scope** — returns all `scope: 'breed'` award types (BOB, BOS) when
 * both maleCandidates and femaleCandidates contain at least one entry whose
 * grade meets the minimum grade of the award type they were proposed for
 * (FCI requires at least Excellent for BOB/BOS eligibility).
 *
 * **group scope** — returns all `scope: 'group'` award types (BIG) when
 * bobCandidates is non-empty.
 *
 * **show scope** — returns all `scope: 'show'` award types (BIS) when
 * bigCandidates is non-empty.
 *
 * `validateAwardChoices` for per-sex scope checks that each proposed
 * assignment targets a dog whose class feeds that award type, and whose
 * grade and placement satisfy the AwardType requirements.  For higher scopes
 * it returns `{ valid: true }`.
 * A discretionary award that is simply absent from the proposed list is
 * never a validation error.
 *
 * This class lives in the `@ods/rulesets/testing` sub-path so the Judging
 * context can use it as a drop-in fake without pulling test tooling into
 * production bundles.
 */
export class FciAwardPolicy implements AwardPolicy {
    eligibleAwardTypes(
        scope: JudgingScopeResults,
        ruleset: EffectiveRuleset,
    ): ReadonlyArray<AwardTypeId> {
        switch (scope.kind) {
            case 'per-sex':
                return this.perSexEligible(scope.placements, ruleset);
            case 'breed': {
                const qualifyingMales = scope.maleCandidates.filter((c) =>
                    this.candidateMeetsBreedMinimumGrade(c, ruleset),
                );
                const qualifyingFemales = scope.femaleCandidates.filter((c) =>
                    this.candidateMeetsBreedMinimumGrade(c, ruleset),
                );
                if (qualifyingMales.length === 0 || qualifyingFemales.length === 0) {
                    return [];
                }
                return ruleset.awardTypes.filter((at) => at.scope === 'breed').map((at) => at.id);
            }
            case 'group':
                if (scope.bobCandidates.length === 0) return [];
                return ruleset.awardTypes.filter((at) => at.scope === 'group').map((at) => at.id);
            case 'show':
                if (scope.bigCandidates.length === 0) return [];
                return ruleset.awardTypes.filter((at) => at.scope === 'show').map((at) => at.id);
        }
    }

    validateAwardChoices(
        scope: JudgingScopeResults,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        if (scope.kind !== 'per-sex') return { valid: true };
        return this.validatePerSex(scope.placements, proposed, ruleset);
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private perSexEligible(
        placements: ReadonlyArray<ClassPlacement>,
        ruleset: EffectiveRuleset,
    ): ReadonlyArray<AwardTypeId> {
        const eligible = new Set<AwardTypeId>();

        for (const placement of placements) {
            const classDef = ruleset.classDefinitions.find((c) => c.id === placement.classId);
            if (!classDef) continue;

            for (const awardTypeId of classDef.awardTypeIds) {
                const awardType = ruleset.awardTypes.find((at) => at.id === awardTypeId);
                if (!awardType) continue;
                if (awardType.scope === 'collective') continue;

                if (meetsAwardRequirements(placement, awardType, classDef, ruleset).meets) {
                    eligible.add(awardTypeId);
                }
            }
        }

        return Array.from(eligible);
    }

    private validatePerSex(
        placements: ReadonlyArray<ClassPlacement>,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        for (const assignment of proposed) {
            const awardType = ruleset.awardTypes.find((at) => at.id === assignment.awardTypeId);
            if (!awardType) {
                return {
                    valid: false,
                    reason: `Unknown award type '${assignment.awardTypeId}'`,
                };
            }
            if (awardType.scope === 'collective') {
                return {
                    valid: false,
                    reason: `Collective award type '${awardType.id}' cannot be proposed in a per-sex scope`,
                };
            }

            const placement = placements.find((p) => p.dogRef === assignment.dogRef);
            if (!placement) {
                return {
                    valid: false,
                    reason: `No placement found for dog '${assignment.dogRef}' in this scope`,
                };
            }

            const classDef = ruleset.classDefinitions.find((c) => c.id === placement.classId);
            if (!classDef) {
                return {
                    valid: false,
                    reason: `Unknown class '${placement.classId}'`,
                };
            }

            if (!classDef.awardTypeIds.includes(assignment.awardTypeId)) {
                return {
                    valid: false,
                    reason: `Award type '${awardType.id}' is not available for dogs in class '${classDef.id}'`,
                };
            }

            const requirement = meetsAwardRequirements(placement, awardType, classDef, ruleset);
            if (!requirement.meets) {
                return { valid: false, reason: requirement.reason };
            }
        }

        return { valid: true };
    }

    /**
     * Returns `true` when `candidate`'s grade meets the strictest minimum
     * grade among all `scope: 'breed'` award types in the ruleset.
     * This guards the breed scope against per-sex feeder awards that carry
     * a lower minimum grade than the breed-scope awards require.
     */
    private candidateMeetsBreedMinimumGrade(
        candidate: CandidateEntry,
        ruleset: EffectiveRuleset,
    ): boolean {
        const breedAwardTypes = ruleset.awardTypes.filter(
            (at): at is IndividualAwardType => at.scope === 'breed',
        );
        const firstBreed = breedAwardTypes[0];
        if (!firstBreed) return false;

        const gradeScale = ruleset.gradeScales.find((gs) =>
            gs.grades.some((g) => g.id === firstBreed.minimumGradeId),
        );
        if (!gradeScale) return false;

        const candidateGrade = gradeScale.grades.find((g) => g.id === candidate.gradeId);
        if (!candidateGrade) return false;

        // Strictest = lowest ordinal across all breed award minimum grades
        let strictestOrdinal = Infinity;
        for (const at of breedAwardTypes) {
            const minGrade = gradeScale.grades.find((g) => g.id === at.minimumGradeId);
            if (minGrade !== undefined && minGrade.ordinal < strictestOrdinal) {
                strictestOrdinal = minGrade.ordinal;
            }
        }

        return strictestOrdinal < Infinity && candidateGrade.ordinal <= strictestOrdinal;
    }
}
