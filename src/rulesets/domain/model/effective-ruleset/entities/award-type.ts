// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, ClassId, GradeId } from '../value-objects/domain-ids.js';
import type { Placement } from '../value-objects/placement.js';

/** The scope level at which an {@link AwardType} is determined. */
export type AwardScope = 'per-sex' | 'breed' | 'group' | 'show' | 'collective';

/**
 * A **Feeder** — the award-or-class source that qualifies a Dog as a candidate
 * for a higher-scope Award (ADR-0017). A feeder is either an
 * {@link AwardType} (e.g. CACIB feeds BOB; BIG feeds BIS) or a Class placement
 * (e.g. the Puppy class 1st feeds Best Puppy in Show). Authored per Ruleset
 * Layer (last layer wins, wholesale replacement).
 *
 * A `kind` discriminant makes the two variants distinguishable without a
 * `'awardTypeId' in feeder` property probe.
 */
export type Feeder =
    | { readonly kind: 'award'; readonly awardTypeId: AwardTypeId }
    | { readonly kind: 'class'; readonly classId: ClassId };

/**
 * An individual-dog award type determined at the per-sex (class) judging level.
 * Per-sex awards are fed by their Class (via `ClassDefinition.awardTypeIds`),
 * not by other awards, so they carry no `fedBy`.
 */
export interface PerSexAwardType {
    readonly id: AwardTypeId;
    /** Minimum Grade a Dog must receive to be eligible for this Award. */
    readonly minimumGradeId: GradeId;
    /**
     * Worst ordinal placement still eligible for this award (1 = best, 2 =
     * second, …). `undefined` when no placement restriction applies. A dog
     * placed worse than this ordinal is not eligible.
     */
    readonly worstEligiblePlacement: Placement | undefined;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
    readonly scope: 'per-sex';
}

/**
 * An individual-dog award type determined at a higher scope (breed/group/show).
 * Higher-scope awards are fed by other awards and/or class placements, so they
 * always declare a `fedBy` (its *presence* on higher-scope awards is the type
 * guarantee here — `PerSexAwardType` has no `fedBy` field; non-emptiness is a
 * construction-time invariant, not enforced by `ReadonlyArray`).
 */
export interface HigherScopeAwardType {
    readonly id: AwardTypeId;
    /** Minimum Grade a Dog must receive to be eligible for this Award. */
    readonly minimumGradeId: GradeId;
    /**
     * Worst ordinal placement still eligible (1 = best). `undefined` when no
     * placement restriction applies; higher-scope awards are usually
     * grade-gated only, so this is typically `undefined`.
     */
    readonly worstEligiblePlacement: Placement | undefined;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
    readonly scope: 'breed' | 'group' | 'show';
    /**
     * The {@link Feeder}s that supply candidates for this higher-scope Award
     * (ADR-0017). A multi-feeder (e.g. BOB draws on CACIB + junior/veteran
     * class wins) is a multi-element array; a single feeder is a one-element
     * array. Always defined for higher-scope awards.
     */
    readonly fedBy: ReadonlyArray<Feeder>;
}

/** An individual-dog award type: per-sex or higher-scope (breed/group/show). */
export type IndividualAwardType = PerSexAwardType | HigherScopeAwardType;

/**
 * A collective-competition award type (Brace/Couple, Breeders' Group,
 * Progeny Group). Has no grade or placement requirement -- structural
 * validity is governed by {@link CollectiveAwardPolicy}.
 */
export interface CollectiveAwardType {
    readonly id: AwardTypeId;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
    readonly scope: 'collective';
}

/**
 * The ruleset-owned definition of a single honour that can be proposed
 * in a judging unit -- e.g. CAC, CACIB, Best of Breed, Best Brace.
 */
export type AwardType = IndividualAwardType | CollectiveAwardType;
