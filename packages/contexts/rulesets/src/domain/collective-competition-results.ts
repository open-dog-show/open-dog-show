// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { BreedId, VarietyId } from './domain-ids.js';

/**
 * A single dog competing within a Collective Competition.
 * Sex is required because Brace/Couple mandates one of each.
 */
export interface CollectiveEntry {
    /** Opaque reference to the judged entry. */
    readonly dogRef: string;
    readonly sex: 'dog' | 'bitch';
}

/**
 * The result of a Collective Competition: a discriminated union over the
 * three FCI collective competition types and the dogs participating in each.
 *
 * Variants:
 * - `brace-couple`   — one dog + one bitch of the same breed/variety
 * - `breeders-group` — 3–5 dogs of the same breed/variety from one kennel
 * - `progeny-group`  — a sire or dam with 3–5 first-generation offspring
 */
export type CollectiveCompetitionResults =
    | {
          readonly kind: 'brace-couple';
          readonly breedId: BreedId;
          readonly varietyId: VarietyId | undefined;
          readonly entries: ReadonlyArray<CollectiveEntry>;
      }
    | {
          readonly kind: 'breeders-group';
          readonly breedId: BreedId;
          readonly varietyId: VarietyId | undefined;
          /** Name of the kennel that bred all competing dogs. */
          readonly kennelName: string;
          readonly entries: ReadonlyArray<CollectiveEntry>;
      }
    | {
          readonly kind: 'progeny-group';
          /** Opaque reference to the sire or dam whose offspring are competing. */
          readonly parentDogRef: string;
          readonly entries: ReadonlyArray<CollectiveEntry>;
      };
