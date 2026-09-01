// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, ClassId, GradeId } from './domain-ids.js';

/** The scope level at which an {@link AwardType} is determined. */
export type AwardScope = 'per-sex' | 'breed' | 'group' | 'show' | 'collective';

/**
 * A **Feeder** — the award-or-class source that qualifies a Dog as a candidate
 * for a higher-scope Award (ADR-0017). A feeder is either an
 * {@link AwardType} (e.g. CACIB feeds BOB; BIG feeds BIS) or a Class placement
 * (e.g. the Puppy class 1st feeds Best Puppy in Show). Authored per Ruleset
 * Layer (last layer wins, wholesale replacement).
 */
export type Feeder = { readonly awardTypeId: AwardTypeId } | { readonly classId: ClassId };

/** An individual-dog award type: one of the four Award Scope Levels. */
export interface IndividualAwardType {
    readonly id: AwardTypeId;
    /** Minimum Grade a Dog must receive to be eligible for this Award. */
    readonly minimumGradeId: GradeId;
    /** Minimum ordinal Placement (1-4) required, or undefined if no placement restriction applies. */
    readonly minimumPlacement: number | undefined;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
    readonly scope: 'per-sex' | 'breed' | 'group' | 'show';
    /**
     * The {@link Feeder}s that supply candidates for this higher-scope Award
     * (ADR-0017). Defined for `scope: 'breed' | 'group' | 'show'`; undefined for
     * `scope: 'per-sex'` (per-sex awards are fed by their Class, not by other
     * awards). A multi-feeder (e.g. BOB draws on CACIB + junior/veteran class
     * wins) is a multi-element array; a single feeder is a one-element array.
     */
    readonly fedBy?: ReadonlyArray<Feeder>;
}

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
