// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, GradeId } from '../domain/value-objects/domain-ids.js';
import type { EntryRef } from '../domain/value-objects/entry-ref.js';
import type { Feeder, IndividualAwardType } from '../domain/entities/award-type.js';
import type { EffectiveRuleset } from '../domain/aggregates/effective-ruleset.js';
import type {
    AwardPolicy,
    AwardValidationResult,
    ProposedAwardAssignment,
} from '../domain/domain-services/award-policy.js';
import type {
    CandidateStream,
    ClassPlacement,
    JudgingScopeResults,
    StreamCandidate,
} from '../domain/value-objects/judging-scope-results.js';
import { meetsAwardRequirements } from './meets-award-requirements.js';

/**
 * In-memory FCI implementation of {@link AwardPolicy}.
 *
 * **per-sex scope** — `eligibleAwardTypes` returns an Award Type ID when at
 * least one dog in the scope satisfies the AwardType's minimumGradeId and
 * minimumPlacement requirements within a class that feeds that award type
 * (via `ClassDefinition.awardTypeIds`). `validateAwardChoices` checks each
 * proposed assignment targets a dog whose class feeds that award type and
 * whose grade and placement satisfy the AwardType requirements.
 *
 * **breed / group / show scope** (ADR-0017) — a generic feeder matcher. For
 * each higher-scope Award Type, the policy resolves its `fedBy` feeders,
 * matches each feeder to a {@link CandidateStream} by feeder key (and `sex`
 * at breed scope), and:
 * - `eligibleAwardTypes` returns the award id only when at least one candidate
 *   across its feeder streams meets the award's `minimumGradeId` (and, at
 *   breed scope, a qualifying male and female are both present — the "both
 *   sexes present" rule, carried by the streams' `sex` tags).
 * - `validateAwardChoices` checks each proposed dog is present in one of the
 *   award's feeder streams and meets its `minimumGradeId`, and that a
 *   non-discretionary award is proposed when it is eligible (has a qualifying
 *   candidate). A discretionary award that is simply absent is never a
 *   validation error.
 *
 * Show-type awareness is by stream presence: out-of-scope feeders match no
 * stream, so the policy needs no show-type parameter.
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
            case 'breed':
            case 'group':
            case 'show':
                return this.higherScopeEligible(scope, ruleset);
        }
    }

    validateAwardChoices(
        scope: JudgingScopeResults,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        switch (scope.kind) {
            case 'per-sex':
                return this.validatePerSex(scope.placements, proposed, ruleset);
            case 'breed':
            case 'group':
            case 'show':
                return this.validateHigherScope(scope, proposed, ruleset);
        }
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

    // -----------------------------------------------------------------------
    // Higher-scope (breed/group/show) feeder matching — ADR-0017
    // -----------------------------------------------------------------------

    private higherScopeEligible(
        scope: Extract<JudgingScopeResults, { streams: ReadonlyArray<CandidateStream> }>,
        ruleset: EffectiveRuleset,
    ): ReadonlyArray<AwardTypeId> {
        const eligible = new Set<AwardTypeId>();
        for (const at of ruleset.awardTypes) {
            if (at.scope === 'per-sex' || at.scope === 'collective') continue;
            if (at.scope !== scope.kind) continue;
            const individual = at;
            if (this.awardIsEligible(individual, scope, ruleset)) {
                eligible.add(individual.id);
            }
        }
        return [...eligible];
    }

    private validateHigherScope(
        scope: Extract<JudgingScopeResults, { streams: ReadonlyArray<CandidateStream> }>,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        for (const assignment of proposed) {
            const awardType = ruleset.awardTypes.find((at) => at.id === assignment.awardTypeId);
            if (!awardType) {
                return { valid: false, reason: `Unknown award type '${assignment.awardTypeId}'` };
            }
            if (awardType.scope === 'collective') {
                return {
                    valid: false,
                    reason: `Collective award type '${awardType.id}' cannot be proposed in a ${scope.kind} scope`,
                };
            }
            if (awardType.scope !== scope.kind) {
                return {
                    valid: false,
                    reason: `Award type '${awardType.id}' (scope ${awardType.scope}) cannot be proposed in a ${scope.kind} scope`,
                };
            }
            const individual = awardType;
            if (!individual.fedBy) {
                return {
                    valid: false,
                    reason: `Award type '${individual.id}' declares no feeders`,
                };
            }
            const candidate = this.feederCandidates(individual.fedBy, scope.streams).find(
                (c) => c.dogRef === assignment.dogRef,
            );
            if (!candidate) {
                return {
                    valid: false,
                    reason: `Dog '${assignment.dogRef}' is not a candidate for award '${individual.id}' from its feeder streams`,
                };
            }
            if (
                !this.candidateMeetsMinimumGrade(
                    candidate.gradeId,
                    individual.minimumGradeId,
                    ruleset,
                )
            ) {
                return {
                    valid: false,
                    reason: `Dog '${assignment.dogRef}' received grade '${candidate.gradeId}' but '${individual.id}' requires at least '${individual.minimumGradeId}'`,
                };
            }
        }

        // Breed scope: BOB and BOS must be opposite-sex, distinct dogs (ADR-0017).
        if (scope.kind === 'breed') {
            const sexOf = (dogRef: EntryRef) =>
                scope.streams.find((s) => s.candidates.some((c) => c.dogRef === dogRef))?.sex;
            const breedProposals = proposed.filter((p) => {
                const at = ruleset.awardTypes.find((a) => a.id === p.awardTypeId);
                return at !== undefined && at.scope === 'breed';
            });
            const refs = breedProposals.map((p) => p.dogRef);
            if (new Set(refs).size !== refs.length) {
                return {
                    valid: false,
                    reason: 'Two breed-scope awards cannot be proposed for the same dog',
                };
            }
            if (breedProposals.length === 2) {
                const sexes = breedProposals.map((p) => sexOf(p.dogRef));
                if (!(sexes.includes('male') && sexes.includes('female'))) {
                    return {
                        valid: false,
                        reason: 'BOB and BOS must be proposed for dogs of opposite sexes',
                    };
                }
            }
        }
        // Non-discretionary awards must be proposed when they are eligible.
        const proposedIds = new Set(proposed.map((p) => p.awardTypeId));
        for (const at of ruleset.awardTypes) {
            if (at.scope === 'per-sex' || at.scope === 'collective') continue;
            if (at.scope !== scope.kind) continue;
            const individual = at;
            if (individual.isDiscretionary) continue;
            if (proposedIds.has(individual.id)) continue;
            if (this.awardIsEligible(individual, scope, ruleset)) {
                return {
                    valid: false,
                    reason: `Non-discretionary award '${individual.id}' must be proposed when its feeder stream has a qualifying candidate`,
                };
            }
        }

        return { valid: true };
    }

    /**
     * Whether a higher-scope award is eligible: at least one candidate across
     * its feeder streams meets its `minimumGradeId`, and (breed scope only) a
     * qualifying male and female are both present via the streams' `sex` tags.
     */
    private awardIsEligible(
        individual: IndividualAwardType,
        scope: Extract<JudgingScopeResults, { streams: ReadonlyArray<CandidateStream> }>,
        ruleset: EffectiveRuleset,
    ): boolean {
        if (!individual.fedBy || individual.fedBy.length === 0) return false;
        const matched = this.matchedStreams(individual.fedBy, scope.streams);
        if (matched.length === 0) return false;
        const minGrade = individual.minimumGradeId;
        const hasQualifying = matched.some((s) => this.streamHasQualifying(s, minGrade, ruleset));
        if (!hasQualifying) return false;
        if (scope.kind === 'breed') {
            const hasMale = matched.some(
                (s) => s.sex === 'male' && this.streamHasQualifying(s, minGrade, ruleset),
            );
            const hasFemale = matched.some(
                (s) => s.sex === 'female' && this.streamHasQualifying(s, minGrade, ruleset),
            );
            return hasMale && hasFemale;
        }
        return true;
    }

    /** Whether `stream` has at least one candidate meeting `minimumGradeId`. */
    private streamHasQualifying(
        stream: CandidateStream,
        minimumGradeId: GradeId,
        ruleset: EffectiveRuleset,
    ): boolean {
        return stream.candidates.some((c) =>
            this.candidateMeetsMinimumGrade(c.gradeId, minimumGradeId, ruleset),
        );
    }
    /** Streams whose feeder key matches any of `fedBy` (key-only; sex is aggregated separately). */
    private matchedStreams(
        fedBy: ReadonlyArray<Feeder>,
        streams: ReadonlyArray<CandidateStream>,
    ): ReadonlyArray<CandidateStream> {
        return streams.filter((s) => fedBy.some((f) => this.feederMatchesStream(f, s)));
    }

    private feederMatchesStream(feeder: Feeder, stream: CandidateStream): boolean {
        if ('awardTypeId' in feeder) {
            return 'feederAwardTypeId' in stream && stream.feederAwardTypeId === feeder.awardTypeId;
        }
        return 'feederClassId' in stream && stream.feederClassId === feeder.classId;
    }

    /** All candidates supplied by the streams matching `fedBy`. */
    private feederCandidates(
        fedBy: ReadonlyArray<Feeder>,
        streams: ReadonlyArray<CandidateStream>,
    ): ReadonlyArray<StreamCandidate> {
        const out: StreamCandidate[] = [];
        for (const s of this.matchedStreams(fedBy, streams)) {
            for (const c of s.candidates) out.push(c);
        }
        return out;
    }

    /**
     * Whether `candidateGradeId` is at least as good as `minimumGradeId`,
     * resolving both on the single grade scale that contains them both.
     * Lower ordinal = better grade (Excellent = 0, Very Good = 1, …).
     */
    private candidateMeetsMinimumGrade(
        candidateGradeId: GradeId,
        minimumGradeId: GradeId,
        ruleset: EffectiveRuleset,
    ): boolean {
        for (const scale of ruleset.gradeScales) {
            const candidateGrade = scale.grades.find((g) => g.id === candidateGradeId);
            const minGrade = scale.grades.find((g) => g.id === minimumGradeId);
            if (candidateGrade && minGrade) {
                return candidateGrade.ordinal <= minGrade.ordinal;
            }
        }
        return false;
    }
}
