// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, GradeId } from './domain-ids.js';

/** The scope level at which an {@link AwardType} is determined. */
export type AwardScope = 'per-sex' | 'breed' | 'group' | 'show';

/**
 * The ruleset-owned definition of a single honour that can be proposed
 * in a judging unit — e.g. CAC, CACIB, Best of Breed.
 */
export interface AwardType {
    readonly id: AwardTypeId;
    readonly name: string;
    /** Minimum Grade a Dog must receive to be eligible for this Award. */
    readonly minimumGradeId: GradeId;
    /**
     * Minimum ordinal Placement (1–4) required, or undefined if no
     * placement restriction applies.
     */
    readonly minimumPlacement: number | undefined;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
    readonly scope: AwardScope;
}
