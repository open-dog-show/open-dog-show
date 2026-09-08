// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { BreedId, VarietyId, GroupId } from '../value-objects/domain-ids.js';

/** FCI recognition status of a Breed; gates award eligibility. */
export type RecognitionStatus = 'definitive' | 'provisional' | 'unrecognised';

/**
 * An officially recognised breed, classified into one {@link Group}.
 * The breed list and classification are ruleset-owned reference data.
 *
 * Per ADR-0010, this type carries no display `name` — breed display strings
 * live in the i18n bundle keyed by `breed.<id>`. The domain owns identity and
 * rules only.
 *
 * Deferred (ADR-0001, amended 2026-08-28, #134): this `Breed` record is not
 * yet wired into `RulesetLayer` / `EffectiveRuleset` — no consumer reads the
 * record today. The `BreedId` brand and this type definition stay as the
 * published contract; data instances land when a consumer (catalogue
 * ordering via `groupId`, breed-recognition gating via `recognitionStatus`)
 * requires them.
 */
export interface Breed {
    readonly id: BreedId;
    readonly groupId: GroupId;
    readonly recognitionStatus: RecognitionStatus;
}

/**
 * A subdivision of a {@link Breed} (by size, coat, or colour) that is
 * judged separately for awards — CACIB is made per Breed and Variety.
 *
 * Per ADR-0010, this type carries no display `name` — variety display strings
 * live in the i18n bundle keyed by `variety.<breed-id>.<variety-id>`
 * (`VarietyId` is breed-scoped, so the breed id namespaces the key). The
 * domain owns identity and rules only.
 *
 * Deferred (ADR-0001, amended 2026-08-28, #134): this `Variety` record is
 * not yet wired into `RulesetLayer` / `EffectiveRuleset`. The `VarietyId`
 * brand (reused by `CollectiveCompetitionResults`) and this type definition
 * stay as the published contract; data instances land when a consumer
 * requires them.
 */
export interface Variety {
    readonly id: VarietyId;
    readonly breedId: BreedId;
}

/**
 * One of the governing body's top-level breed groupings (the FCI defines 10).
 * Used for catalogue division and the Best in Group competition.
 *
 * Per ADR-0010, this type carries no display `name` — group display strings
 * live in the i18n bundle keyed by `group.<id>`. `ordinal` is retained: it is
 * structural catalogue ordering, not a display string. The domain owns
 * identity and rules only.
 *
 * Deferred (ADR-0001, amended 2026-08-28, #134): this `Group` record is not
 * yet wired into `RulesetLayer` / `EffectiveRuleset`. The `GroupId` brand and
 * this type definition stay as the published contract; data instances (with
 * `ordinal` for catalogue ordering) land when a consumer requires them.
 */
export interface Group {
    readonly id: GroupId;
    /** Governs catalogue ordering; lower ordinal appears first. */
    readonly ordinal: number;
}
