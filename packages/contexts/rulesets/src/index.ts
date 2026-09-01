// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type {
    ClassId,
    AwardTypeId,
    GradeId,
    SpecialOutcomeId,
    GradeScaleId,
    BreedId,
    VarietyId,
    GroupId,
    ShowTypeId,
    RulesetLayerId,
    EffectiveRulesetId,
} from './domain/domain-ids.js';
export {
    asClassId,
    asAwardTypeId,
    asGradeId,
    asSpecialOutcomeId,
    asGradeScaleId,
    asBreedId,
    asVarietyId,
    asGroupId,
    asShowTypeId,
    asRulesetLayerId,
    asEffectiveRulesetId,
} from './domain/domain-ids.js';
export type { LocalDate } from './domain/local-date.js';
export { CertificateKind } from './domain/certificate-kind.js';
export type { DogEligibilityProfile } from './domain/dog-eligibility-profile.js';
export type { ClassEligibilityPolicy } from './domain/class-eligibility-policy.js';
export type { Grade, SpecialOutcome, GradeScale } from './domain/grade-scale.js';
export type { ClassDefinition } from './domain/class-definition.js';
export type {
    AwardScope,
    AwardType,
    IndividualAwardType,
    CollectiveAwardType,
    Feeder,
} from './domain/award-type.js';
export type { RecognitionStatus, Breed, Variety, Group } from './domain/breed.js';
export type { ShowType } from './domain/show-type.js';
export type { EffectiveRuleset } from './domain/effective-ruleset.js';
export type { RulesetLayer } from './domain/ruleset-layer.js';
export { resolveEffectiveRuleset } from './domain/resolve-effective-ruleset.js';
export type {
    ClassPlacement,
    StreamCandidate,
    CandidateStream,
    AwardFeederStream,
    ClassFeederStream,
    JudgingScopeResults,
} from './domain/judging-scope-results.js';
export type {
    ProposedAwardAssignment,
    AwardValidationResult,
    AwardPolicy,
} from './domain/award-policy.js';
export type {
    CollectiveEntry,
    CollectiveCompetitionResults,
    CollectiveCompetitionKind,
} from './domain/collective-competition-results.js';
export type {
    CollectiveAwardResult,
    CollectiveAwardPolicy,
} from './domain/collective-award-policy.js';
