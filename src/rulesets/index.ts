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
    EffectiveRulesetId,
    RulesetLayerId,
} from './domain/shared/domain-ids.js';
export {
    InvalidAgeMonthsError,
    type AgeMonths,
} from './domain/model/effective-ruleset/value-objects/age-months.js';
export type { EntryRef } from './domain/service/collective-award-policy/entry-ref.js';
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
    asEffectiveRulesetId,
} from './domain/shared/domain-ids.js';
export { asAgeMonths } from './domain/model/effective-ruleset/value-objects/age-months.js';
export { asEntryRef } from './domain/service/collective-award-policy/entry-ref.js';
export type { Sex } from './domain/model/effective-ruleset/value-objects/sex.js';
export {
    asPlacement,
    InvalidPlacementError,
    type Placement,
} from './domain/service/award-policy/placement.js';
export {
    LocalDate,
    InvalidLocalDateError,
    LocalDateBeforeReferenceError,
} from './domain/model/effective-ruleset/value-objects/local-date.js';
export {
    CERTIFICATE_KIND,
    type CertificateKind,
} from './domain/model/effective-ruleset/value-objects/certificate-kind.js';
export {
    EntryEligibilityProfile,
    type EntryEligibilityProfileAttributes,
} from './domain/service/class-eligibility-policy/entry-eligibility-profile.js';
export type { ClassEligibilityPolicy } from './domain/service/class-eligibility-policy/class-eligibility-policy.js';
export {
    type GradeOrdinal,
    InvalidGradeOrdinalError,
    asGradeOrdinal,
} from './domain/model/effective-ruleset/value-objects/grade-ordinal.js';
export {
    Grade,
    SpecialOutcome,
    GradeScale,
    UnknownPlaceableThresholdError,
    type GradeScaleAttributes,
} from './domain/model/effective-ruleset/entities/grade-scale.js';
export {
    ClassDefinition,
    InvalidClassAgeRangeError,
    type ClassDefinitionAttributes,
} from './domain/model/effective-ruleset/entities/class-definition.js';
export {
    AwardFeeder,
    ClassFeeder,
    PerSexAwardType,
    type PerSexAwardTypeAttributes,
    HigherScopeAwardType,
    type HigherScopeAwardTypeAttributes,
    EmptyFeederListError,
    CollectiveAwardType,
    type CollectiveAwardTypeAttributes,
    type AwardScope,
    type AwardType,
    type IndividualAwardType,
    type Feeder,
} from './domain/model/effective-ruleset/entities/award-type.js';
export {
    Breed,
    type BreedAttributes,
    Variety,
    type VarietyAttributes,
    Group,
    type GroupAttributes,
    type RecognitionStatus,
} from './domain/model/effective-ruleset/entities/breed.js';
export {
    ShowType,
    type ShowTypeAttributes,
} from './domain/model/effective-ruleset/entities/show-type.js';
export {
    EffectiveRuleset,
    UnknownGradeScaleReferenceError,
    UnknownAwardTypeReferenceError,
    UnknownMinimumGradeReferenceError,
} from './domain/model/effective-ruleset/effective-ruleset.js';
export type { RulesetLayerEditionReference } from './domain/model/ruleset-layer-edition/ruleset-layer-edition.js';
export {
    ClassPlacement,
    type ClassPlacementAttributes,
    StreamCandidate,
    AwardFeederStream,
    type AwardFeederStreamAttributes,
    ClassFeederStream,
    type ClassFeederStreamAttributes,
    type CandidateStream,
    PerSexJudgingScopeResults,
    type PerSexJudgingScopeResultsAttributes,
    HigherScopeJudgingScopeResults,
    type HigherScopeJudgingScopeKind,
    type JudgingScopeResults,
} from './domain/service/award-policy/judging-scope-results.js';
export type {
    ProposedAwardAssignment,
    AwardValidationResult,
    AwardPolicy,
} from './domain/service/award-policy/award-policy.js';
export { CollectiveEntry } from './domain/service/collective-award-policy/collective-entry.js';
export { BreedVarietyRef } from './domain/service/collective-award-policy/breed-variety-ref.js';
export {
    BraceCoupleCompetitionResults,
    type BraceCoupleCompetitionResultsAttributes,
    BreedersGroupCompetitionResults,
    type BreedersGroupCompetitionResultsAttributes,
    ProgenyGroupCompetitionResults,
    type ProgenyGroupCompetitionResultsAttributes,
    type CollectiveCompetitionResults,
    type CollectiveCompetitionKind,
} from './domain/service/collective-award-policy/collective-competition-results.js';
export type {
    CollectiveAwardResult,
    CollectiveAwardPolicy,
} from './domain/service/collective-award-policy/collective-award-policy.js';
