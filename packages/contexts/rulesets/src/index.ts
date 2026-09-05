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
} from './domain/value-objects/domain-ids.js';
export type { AgeMonths } from './domain/value-objects/age-months.js';
export type { EntryRef } from './domain/value-objects/entry-ref.js';
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
} from './domain/value-objects/domain-ids.js';
export { asAgeMonths } from './domain/value-objects/age-months.js';
export { asEntryRef } from './domain/value-objects/entry-ref.js';
export { LocalDate, InvalidLocalDateError } from './domain/value-objects/local-date.js';
export { CertificateKind } from './domain/value-objects/certificate-kind.js';
export type { DogEligibilityProfile } from './domain/value-objects/dog-eligibility-profile.js';
export type { ClassEligibilityPolicy } from './domain/domain-services/class-eligibility-policy.js';
export type { Grade, SpecialOutcome, GradeScale } from './domain/entities/grade-scale.js';
export type { ClassDefinition } from './domain/entities/class-definition.js';
export type {
    AwardScope,
    AwardType,
    IndividualAwardType,
    CollectiveAwardType,
    Feeder,
} from './domain/entities/award-type.js';
export type { RecognitionStatus, Breed, Variety, Group } from './domain/entities/breed.js';
export type { ShowType } from './domain/entities/show-type.js';
export type { EffectiveRuleset } from './domain/aggregates/effective-ruleset.js';
export type { RulesetLayer } from './domain/entities/ruleset-layer.js';
export { resolveEffectiveRuleset } from './domain/domain-services/resolve-effective-ruleset.js';
export type {
    ClassPlacement,
    StreamCandidate,
    CandidateStream,
    AwardFeederStream,
    ClassFeederStream,
    JudgingScopeResults,
} from './domain/value-objects/judging-scope-results.js';
export type {
    ProposedAwardAssignment,
    AwardValidationResult,
    AwardPolicy,
} from './domain/domain-services/award-policy.js';
export type {
    CollectiveEntry,
    CollectiveCompetitionResults,
    CollectiveCompetitionKind,
} from './domain/value-objects/collective-competition-results.js';
export type {
    CollectiveAwardResult,
    CollectiveAwardPolicy,
} from './domain/domain-services/collective-award-policy.js';
