// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CollectiveCompetitionResults } from './collective-competition-results.js';
import type { EntryRef } from './entry-ref.js';

/**
 * The outcome of evaluating a Collective Competition.
 * On success, `winningTeamEntryRefs` lists every participating dog entry that
 * forms the winning Team.  On failure, `reason` is a human-readable
 * description of the first violation.
 */
export type CollectiveAwardResult =
    | {
          readonly valid: true;
          /**
           * Opaque entry refs of every dog that forms the winning Team.
           * All entries are co-winners; collective competitions have no
           * internal ranking.
           */
          readonly winningTeamEntryRefs: readonly EntryRef[];
      }
    | { readonly valid: false; readonly reason: string };

/**
 * Port: validates and awards a Collective Competition (Brace/Couple,
 * Breeders' Group, or Progeny Group).
 *
 * The Judging context calls this policy without knowing which kennel-club
 * ruleset is in force.  The FCI domain-service implementation lives in
 * `domain/service/fci/` (relative-import barrel); the composition root
 * (`apps/api`) will wire it. See ADR-0001 / ADR-0021.
 */
export interface CollectiveAwardPolicy {
    /**
     * Validates the participating entries for the given collective
     * competition type and, when valid, returns the winning Team.
     *
     * Returns `{ valid: true, winningTeamEntryRefs }` when all structural
     * rules are satisfied.
     * Returns `{ valid: false, reason }` for the first violation found.
     */
    evaluate(results: CollectiveCompetitionResults): CollectiveAwardResult;
}
