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
} from './domain/model/effective-ruleset/value-objects/domain-ids.js';
export {
    InvalidAgeMonthsError,
    type AgeMonths,
} from './domain/model/effective-ruleset/value-objects/age-months.js';
export type { EntryRef } from './domain/model/effective-ruleset/value-objects/entry-ref.js';
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
} from './domain/model/effective-ruleset/value-objects/domain-ids.js';
export { asAgeMonths } from './domain/model/effective-ruleset/value-objects/age-months.js';
export { asEntryRef } from './domain/model/effective-ruleset/value-objects/entry-ref.js';
export type { Sex } from './domain/model/effective-ruleset/value-objects/sex.js';
export {
    asPlacement,
    InvalidPlacementError,
    type Placement,
} from './domain/model/effective-ruleset/value-objects/placement.js';
export {
    LocalDate,
    InvalidLocalDateError,
    LocalDateBeforeReferenceError,
} from './domain/model/effective-ruleset/value-objects/local-date.js';
export { CertificateKind } from './domain/model/effective-ruleset/value-objects/certificate-kind.js';
export {
    DogEligibilityProfile,
    type DogEligibilityProfileAttributes,
} from './domain/model/effective-ruleset/value-objects/dog-eligibility-profile.js';
export type { ClassEligibilityPolicy } from './domain/service/class-eligibility-policy.js';
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
export {
    RulesetLayer,
    type RulesetLayerAttributes,
} from './domain/model/effective-ruleset/entities/ruleset-layer.js';
export { resolveEffectiveRuleset } from './domain/service/resolve-effective-ruleset.js';
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
} from './domain/model/effective-ruleset/value-objects/judging-scope-results.js';
export type {
    ProposedAwardAssignment,
    AwardValidationResult,
    AwardPolicy,
} from './domain/service/award-policy.js';
export {
    CollectiveEntry,
    BreedVarietyRef,
    BraceCoupleCompetitionResults,
    type BraceCoupleCompetitionResultsAttributes,
    BreedersGroupCompetitionResults,
    type BreedersGroupCompetitionResultsAttributes,
    ProgenyGroupCompetitionResults,
    type ProgenyGroupCompetitionResultsAttributes,
    type CollectiveCompetitionResults,
    type CollectiveCompetitionKind,
} from './domain/model/effective-ruleset/value-objects/collective-competition-results.js';
export type {
    CollectiveAwardResult,
    CollectiveAwardPolicy,
} from './domain/service/collective-award-policy.js';
