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
export type { AgeMonths } from './domain/model/effective-ruleset/value-objects/age-months.js';
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
    type Placement,
} from './domain/model/effective-ruleset/value-objects/placement.js';
export {
    LocalDate,
    InvalidLocalDateError,
} from './domain/model/effective-ruleset/value-objects/local-date.js';
export { CertificateKind } from './domain/model/effective-ruleset/value-objects/certificate-kind.js';
export type { DogEligibilityProfile } from './domain/model/effective-ruleset/value-objects/dog-eligibility-profile.js';
export type { ClassEligibilityPolicy } from './domain/service/class-eligibility-policy.js';
export type {
    Grade,
    SpecialOutcome,
    GradeScale,
} from './domain/model/effective-ruleset/entities/grade-scale.js';
export type { ClassDefinition } from './domain/model/effective-ruleset/entities/class-definition.js';
export type {
    AwardScope,
    AwardType,
    IndividualAwardType,
    PerSexAwardType,
    HigherScopeAwardType,
    CollectiveAwardType,
    Feeder,
} from './domain/model/effective-ruleset/entities/award-type.js';
export type {
    RecognitionStatus,
    Breed,
    Variety,
    Group,
} from './domain/model/effective-ruleset/entities/breed.js';
export type { ShowType } from './domain/model/effective-ruleset/entities/show-type.js';
export type { EffectiveRuleset } from './domain/model/effective-ruleset/effective-ruleset.js';
export {
    findAwardType,
    findClassDefinition,
    findGrade,
    higherScopeAwardTypesForScope,
} from './domain/model/effective-ruleset/effective-ruleset.js';
export type { RulesetLayer } from './domain/model/effective-ruleset/entities/ruleset-layer.js';
export { resolveEffectiveRuleset } from './domain/service/resolve-effective-ruleset.js';
export type {
    ClassPlacement,
    StreamCandidate,
    CandidateStream,
    AwardFeederStream,
    ClassFeederStream,
    JudgingScopeResults,
} from './domain/model/effective-ruleset/value-objects/judging-scope-results.js';
export type {
    ProposedAwardAssignment,
    AwardValidationResult,
    AwardPolicy,
} from './domain/service/award-policy.js';
export type {
    CollectiveEntry,
    BreedVarietyRef,
    CollectiveCompetitionResults,
    CollectiveCompetitionKind,
} from './domain/model/effective-ruleset/value-objects/collective-competition-results.js';
export type {
    CollectiveAwardResult,
    CollectiveAwardPolicy,
} from './domain/service/collective-award-policy.js';
