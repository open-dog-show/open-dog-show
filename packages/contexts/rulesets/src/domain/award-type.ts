// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, GradeId } from './domain-ids.js';

/** The scope level at which an {@link AwardType} is determined. */
export type AwardScope = 'per-sex' | 'breed' | 'group' | 'show' | 'collective';

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
