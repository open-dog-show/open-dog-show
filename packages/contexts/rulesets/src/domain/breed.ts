// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { BreedId, VarietyId, GroupId } from './domain-ids.js';

/** FCI recognition status of a Breed; gates award eligibility. */
export type RecognitionStatus = 'definitive' | 'provisional' | 'unrecognised';

/**
 * An officially recognised breed, classified into one {@link Group}.
 * The breed list and classification are ruleset-owned reference data.
 */
export interface Breed {
    readonly id: BreedId;
    readonly name: string;
    readonly groupId: GroupId;
    readonly recognitionStatus: RecognitionStatus;
}

/**
 * A subdivision of a {@link Breed} (by size, coat, or colour) that is
 * judged separately for awards — CACIB is made per Breed and Variety.
 */
export interface Variety {
    readonly id: VarietyId;
    readonly breedId: BreedId;
    readonly name: string;
}

/**
 * One of the governing body's top-level breed groupings (the FCI defines 10).
 * Used for catalogue division and the Best in Group competition.
 */
export interface Group {
    readonly id: GroupId;
    readonly name: string;
    /** Governs catalogue ordering; lower ordinal appears first. */
    readonly ordinal: number;
}
