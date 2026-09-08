// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
    AwardTypeId,
    GradeId,
} from '../../model/effective-ruleset/value-objects/domain-ids.js';
import type { EntryRef } from '../../model/effective-ruleset/value-objects/entry-ref.js';
import type {
    Feeder,
    HigherScopeAwardType,
} from '../../model/effective-ruleset/entities/award-type.js';
import type { EffectiveRuleset } from '../../model/effective-ruleset/effective-ruleset.js';
import {
    findAwardType,
    findClassDefinition,
    higherScopeAwardTypesForScope,
} from '../../model/effective-ruleset/effective-ruleset.js';
import type {
    AwardPolicy,
    AwardValidationResult,
    ProposedAwardAssignment,
} from '../award-policy.js';
import type {
    CandidateStream,
    ClassPlacement,
    JudgingScopeResults,
    StreamCandidate,
} from '../../model/effective-ruleset/value-objects/judging-scope-results.js';
import { meetsAwardRequirements } from './meets-award-requirements.js';
import { gradeAtLeast, resolveGradePairOnSharedScale } from './grade-comparison.js';

/**
 * BOB and BOS — the two breed-scope awards that, when both proposed, must
 * target dogs of opposite sexes (ADR-0017). Replaces the bare `=== 2` literal.
 */
const BOB_AND_BOS_PROPOSAL_COUNT = 2;

/**
 * The breed/group/show scopes — the {@link JudgingScopeResults} variants that
 * carry feeder-keyed candidate `streams`.  Aliased so every higher-scope
 * helper shares one readable parameter type.
 */
type StreamedScope = Extract<JudgingScopeResults, { streams: ReadonlyArray<CandidateStream> }>;

/**
 * In-memory FCI implementation of {@link AwardPolicy}.
 *
 * **per-sex scope** — `eligibleAwardTypes` returns an Award Type ID when at
 * least one dog in the scope satisfies the AwardType's minimumGradeId and
 * worstEligiblePlacement requirements within a class that feeds that award type
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
 * This is a pure in-memory domain service (ADR-0001: concrete rulesets are
 * pure domain modules that depend only on the domain core) — not a test
 * double. It lives in the domain layer (`domain/service/fci/`) and is exported
 * from the `domain/service/fci/` relative-import barrel, kept separate from
 * `src/rulesets/index.ts` so the main export stays the abstraction surface
 * (the ports + data model); the composition root (`apps/api`) will wire it.
 * See ADR-0021.
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
            const classDef = findClassDefinition(ruleset, placement.classId);
            if (classDef === undefined) continue;

            for (const awardTypeId of classDef.awardTypeIds) {
                const awardType = findAwardType(ruleset, awardTypeId);
                if (awardType === undefined || awardType.scope === 'collective') continue;

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
            const result = this.validateOnePerSexAssignment(assignment, placements, ruleset);
            if (!result.valid) return result;
        }
        return { valid: true };
    }

    /**
     * Validates a single proposed per-sex assignment: the award type exists and
     * is per-sex, the proposed dog has a placement, its class feeds that award
     * type, and the dog's grade/placement satisfy the award's requirements.
     * Returns `{ valid: true }` when the assignment passes every check.
     */
    private validateOnePerSexAssignment(
        assignment: ProposedAwardAssignment,
        placements: ReadonlyArray<ClassPlacement>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        const awardType = findAwardType(ruleset, assignment.awardTypeId);
        if (awardType === undefined) {
            return { valid: false, reason: `Unknown award type '${assignment.awardTypeId}'` };
        }
        if (awardType.scope === 'collective') {
            return {
                valid: false,
                reason: `Collective award type '${awardType.id}' cannot be proposed in a per-sex scope`,
            };
        }

        const placement = placements.find((p) => p.entryRef === assignment.entryRef);
        if (placement === undefined) {
            return {
                valid: false,
                reason: `No placement found for dog '${assignment.entryRef}' in this scope`,
            };
        }

        const classDef = findClassDefinition(ruleset, placement.classId);
        if (classDef === undefined) {
            return { valid: false, reason: `Unknown class '${placement.classId}'` };
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
        return { valid: true };
    }

    // -----------------------------------------------------------------------
    // Higher-scope (breed/group/show) feeder matching — ADR-0017
    // -----------------------------------------------------------------------

    private higherScopeEligible(
        scope: StreamedScope,
        ruleset: EffectiveRuleset,
    ): ReadonlyArray<AwardTypeId> {
        const eligible = new Set<AwardTypeId>();
        for (const individual of higherScopeAwardTypesForScope(ruleset, scope.kind)) {
            if (this.awardIsEligible(individual, scope, ruleset)) {
                eligible.add(individual.id);
            }
        }
        return [...eligible];
    }

    private validateHigherScope(
        scope: StreamedScope,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        for (const assignment of proposed) {
            const assignmentResult = this.validateOneHigherScopeAssignment(
                scope,
                assignment,
                ruleset,
            );
            if (!assignmentResult.valid) return assignmentResult;
        }

        const breedInvariant = this.validateBreedScopeInvariants(scope, proposed, ruleset);
        if (breedInvariant !== undefined) return breedInvariant;

        const completeness = this.requireNonDiscretionaryAwards(scope, proposed, ruleset);
        if (completeness !== undefined) return completeness;

        return { valid: true };
    }

    /**
     * Validates a single proposed assignment within a breed/group/show scope:
     * the award type exists, is in the right scope, declares feeders, the
     * proposed dog is among its feeder-stream candidates, and the dog's grade
     * meets the award's minimum.  Returns `{ valid: true }` when the
     * assignment passes every check.
     */
    private validateOneHigherScopeAssignment(
        scope: StreamedScope,
        assignment: ProposedAwardAssignment,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult {
        const awardType = findAwardType(ruleset, assignment.awardTypeId);
        if (awardType === undefined) {
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
        if (individual.fedBy.length === 0) {
            return {
                valid: false,
                reason: `Award type '${individual.id}' declares no feeders`,
            };
        }
        const candidate = this.feederCandidates(individual.fedBy, scope.streams).find(
            (c) => c.entryRef === assignment.entryRef,
        );
        if (!candidate) {
            return {
                valid: false,
                reason: `Dog '${assignment.entryRef}' is not a candidate for award '${individual.id}' from its feeder streams`,
            };
        }
        if (
            !this.candidateMeetsMinimumGrade(candidate.gradeId, individual.minimumGradeId, ruleset)
        ) {
            return {
                valid: false,
                reason: `Dog '${assignment.entryRef}' received grade '${candidate.gradeId}' but '${individual.id}' requires at least '${individual.minimumGradeId}'`,
            };
        }
        return { valid: true };
    }

    /**
     * Breed-scope invariants: BOB and BOS must be proposed for distinct dogs
     * of opposite sexes (ADR-0017).  Returns the first violation, or
     * `undefined` when the scope is not breed or the invariants hold.
     */
    private validateBreedScopeInvariants(
        scope: StreamedScope,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult | undefined {
        if (scope.kind !== 'breed') return undefined;

        const sexOf = (entryRef: EntryRef) =>
            scope.streams.find((s) => s.candidates.some((c) => c.entryRef === entryRef))?.sex;
        const breedProposals = proposed.filter((p) => {
            const at = findAwardType(ruleset, p.awardTypeId);
            return at !== undefined && at.scope === 'breed';
        });
        const refs = breedProposals.map((p) => p.entryRef);
        if (new Set(refs).size !== refs.length) {
            return {
                valid: false,
                reason: 'Two breed-scope awards cannot be proposed for the same dog',
            };
        }
        if (breedProposals.length === BOB_AND_BOS_PROPOSAL_COUNT) {
            const sexes = breedProposals.map((p) => sexOf(p.entryRef));
            if (!(sexes.includes('male') && sexes.includes('female'))) {
                return {
                    valid: false,
                    reason: 'BOB and BOS must be proposed for dogs of opposite sexes',
                };
            }
        }
        return undefined;
    }

    /**
     * Non-discretionary higher-scope awards must be proposed when they are
     * eligible (their feeder stream has a qualifying candidate).  Returns the
     * first missing mandatory award, or `undefined` when all are satisfied.
     */
    private requireNonDiscretionaryAwards(
        scope: StreamedScope,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult | undefined {
        const proposedIds = new Set(proposed.map((p) => p.awardTypeId));
        for (const individual of higherScopeAwardTypesForScope(ruleset, scope.kind)) {
            if (individual.isDiscretionary) continue;
            if (proposedIds.has(individual.id)) continue;
            if (this.awardIsEligible(individual, scope, ruleset)) {
                return {
                    valid: false,
                    reason: `Non-discretionary award '${individual.id}' must be proposed when its feeder stream has a qualifying candidate`,
                };
            }
        }
        return undefined;
    }

    /**
     * Whether a higher-scope award is eligible: at least one candidate across
     * its feeder streams meets its `minimumGradeId`, and (breed scope only) a
     * qualifying male and female are both present via the streams' `sex` tags.
     */
    private awardIsEligible(
        individual: HigherScopeAwardType,
        scope: StreamedScope,
        ruleset: EffectiveRuleset,
    ): boolean {
        if (individual.fedBy.length === 0) return false;
        const matched = this.matchedStreams(individual.fedBy, scope.streams);
        if (matched.length === 0) return false;
        // Resolve the qualifying streams once and derive sex presence from
        // that list, rather than re-scanning the matched streams per sex.
        const qualifying = matched.filter((s) =>
            this.streamHasQualifying(s, individual.minimumGradeId, ruleset),
        );
        if (qualifying.length === 0) return false;
        if (scope.kind === 'breed') {
            return (
                qualifying.some((s) => s.sex === 'male') &&
                qualifying.some((s) => s.sex === 'female')
            );
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
        if (feeder.kind === 'award' && stream.kind === 'award') {
            return stream.feederAwardTypeId === feeder.awardTypeId;
        }
        if (feeder.kind === 'class' && stream.kind === 'class') {
            return stream.feederClassId === feeder.classId;
        }
        return false;
    }

    /** All candidates supplied by the streams matching `fedBy`. */
    private feederCandidates(
        fedBy: ReadonlyArray<Feeder>,
        streams: ReadonlyArray<CandidateStream>,
    ): ReadonlyArray<StreamCandidate> {
        return this.matchedStreams(fedBy, streams).flatMap((s) => [...s.candidates]);
    }

    /**
     * Whether `candidateGradeId` is at least as good as `minimumGradeId`,
     * resolving both on the single grade scale that contains them. Lower
     * ordinal = better grade (Excellent = 0, Very Good = 1, …).
     */
    private candidateMeetsMinimumGrade(
        candidateGradeId: GradeId,
        minimumGradeId: GradeId,
        ruleset: EffectiveRuleset,
    ): boolean {
        const pair = resolveGradePairOnSharedScale(candidateGradeId, minimumGradeId, ruleset);
        return pair !== undefined && gradeAtLeast(pair.candidate, pair.minimum);
    }
}
