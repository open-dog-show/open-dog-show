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
} from './domain/domain-ids.js';
export type { LocalDate } from './domain/local-date.js';
export { CertificateKind } from './domain/certificate-kind.js';
export type { CertificateKind } from './domain/certificate-kind.js';
export type { Grade, SpecialOutcome, GradeScale } from './domain/grade-scale.js';
export type { ClassDefinition } from './domain/class-definition.js';
export type { AwardScope, AwardType } from './domain/award-type.js';
export type { RecognitionStatus, Breed, Variety, Group } from './domain/breed.js';
export type { ShowType } from './domain/show-type.js';
export type { EffectiveRuleset } from './domain/effective-ruleset.js';
// RulesetLayer is intentionally NOT exported — it is an internal type
// used only by resolveEffectiveRuleset (a future ticket).
