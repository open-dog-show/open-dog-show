// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { BreedId, VarietyId } from './domain-ids.js';
import type { EntryRef } from './entry-ref.js';
import type { Sex } from './sex.js';

/**
 * A breed (and optional variety) pair — the shared breed/variety identity that
 * several collective competitions require participants to share. Bundled as one
 * value object so the `(breedId, varietyId)` pair travels together and a
 * caller cannot pass one without the other.
 */
export interface BreedVarietyRef {
    readonly breedId: BreedId;
    readonly varietyId: VarietyId | undefined;
}

/**
 * A single dog competing within a Collective Competition.
 * Sex is required because Brace/Couple mandates one of each.
 */
export interface CollectiveEntry {
    /** Opaque reference to the judged entry. */
    readonly entryRef: EntryRef;
    readonly sex: Sex;
}

/**
 * The three FCI collective competition types.
 * Derived from the `kind` discriminant of {@link CollectiveCompetitionResults}
 * so the two never diverge.
 */
export type CollectiveCompetitionKind = CollectiveCompetitionResults['kind'];

/**
 * The result of a Collective Competition: a discriminated union over the
 * three FCI collective competition types and the dogs participating in each.
 *
 * Variants:
 * - `brace-couple`   — one male + one female of the same breed/variety
 * - `breeders-group` — 3–5 dogs of the same breed/variety from one kennel
 * - `progeny-group`  — a sire or dam with 3–5 first-generation offspring
 */
export type CollectiveCompetitionResults =
    | {
          readonly kind: 'brace-couple';
          readonly breed: BreedVarietyRef;
          readonly entries: ReadonlyArray<CollectiveEntry>;
      }
    | {
          readonly kind: 'breeders-group';
          readonly breed: BreedVarietyRef;
          /** Name of the kennel that bred all competing dogs. */
          readonly kennelName: string;
          readonly entries: ReadonlyArray<CollectiveEntry>;
      }
    | {
          readonly kind: 'progeny-group';
          /** Opaque reference to the sire or dam whose offspring are competing. */
          readonly parentEntryRef: EntryRef;
          readonly entries: ReadonlyArray<CollectiveEntry>;
      };
