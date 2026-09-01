// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare const __brand: unique symbol;

/**
 * Compile-time brand helper — keeps rulesets IDs distinct from each other
 * and from kernel IDs even though all are plain strings at runtime.
 */
export type Brand<T, B> = T & { readonly [__brand]: B };

/** Branded string identifying a Class within a Ruleset. */
export type ClassId = Brand<string, 'ClassId'>;
/** Branded string identifying an AwardType within a Ruleset. */
export type AwardTypeId = Brand<string, 'AwardTypeId'>;
/** Branded string identifying a Grade within a GradeScale. */
export type GradeId = Brand<string, 'GradeId'>;
/** Branded string identifying a SpecialOutcome (e.g. Disqualified). */
export type SpecialOutcomeId = Brand<string, 'SpecialOutcomeId'>;
/** Branded string identifying a GradeScale within a Ruleset. */
export type GradeScaleId = Brand<string, 'GradeScaleId'>;
/** Branded string identifying a Breed within a Ruleset. */
export type BreedId = Brand<string, 'BreedId'>;
/** Branded string identifying a Variety within a Breed. */
export type VarietyId = Brand<string, 'VarietyId'>;
/** Branded string identifying a Group within a Ruleset. */
export type GroupId = Brand<string, 'GroupId'>;
/** Branded string identifying a ShowType within a Ruleset. */
export type ShowTypeId = Brand<string, 'ShowTypeId'>;
/** Branded string identifying a RulesetLayer. */
export type RulesetLayerId = Brand<string, 'RulesetLayerId'>;
/** Branded string identifying an EffectiveRuleset snapshot. */
export type EffectiveRulesetId = Brand<string, 'EffectiveRulesetId'>;

/** Casts a raw string to a {@link ClassId}. */
export const asClassId = (id: string): ClassId => id as ClassId;
/** Casts a raw string to an {@link AwardTypeId}. */
export const asAwardTypeId = (id: string): AwardTypeId => id as AwardTypeId;
/** Casts a raw string to a {@link GradeId}. */
export const asGradeId = (id: string): GradeId => id as GradeId;
/** Casts a raw string to a {@link SpecialOutcomeId}. */
export const asSpecialOutcomeId = (id: string): SpecialOutcomeId => id as SpecialOutcomeId;
/** Casts a raw string to a {@link GradeScaleId}. */
export const asGradeScaleId = (id: string): GradeScaleId => id as GradeScaleId;
/** Casts a raw string to a {@link BreedId}. */
export const asBreedId = (id: string): BreedId => id as BreedId;
/** Casts a raw string to a {@link VarietyId}. */
export const asVarietyId = (id: string): VarietyId => id as VarietyId;
/** Casts a raw string to a {@link GroupId}. */
export const asGroupId = (id: string): GroupId => id as GroupId;
/** Casts a raw string to a {@link ShowTypeId}. */
export const asShowTypeId = (id: string): ShowTypeId => id as ShowTypeId;
/** Casts a raw string to a {@link RulesetLayerId}. */
export const asRulesetLayerId = (id: string): RulesetLayerId => id as RulesetLayerId;
/** Casts a raw string to an {@link EffectiveRulesetId}. */
export const asEffectiveRulesetId = (id: string): EffectiveRulesetId => id as EffectiveRulesetId;
