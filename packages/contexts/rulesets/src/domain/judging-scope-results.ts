// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeId, AwardTypeId } from './domain-ids.js';

/**
 * A single dog's result within a per-sex class judging — the grade the judge
 * awarded and the ordinal placement within the class.
 */
export interface ClassPlacement {
    /** The class in which this dog was judged. */
    readonly classId: ClassId;
    /** Opaque reference to the judged entry (opaque to the Rulesets context). */
    readonly dogRef: string;
    /** Grade awarded by the judge. */
    readonly gradeId: GradeId;
    /**
     * Ordinal placement within the class (1 = first, 2 = second, …).
     * Undefined when the dog received a grade below the placeable threshold.
     */
    readonly placement: number | undefined;
}

/**
 * A dog that has won a per-sex award and is therefore a candidate for a
 * higher-scope award (BOB, BIG, BIS).
 */
export interface CandidateEntry {
    /** Opaque reference to the judged entry. */
    readonly dogRef: string;
    /** The grade the dog received during per-sex judging. */
    readonly gradeId: GradeId;
    /** The per-sex award type that qualifies the dog for this higher scope. */
    readonly awardTypeId: AwardTypeId;
}

/**
 * Discriminated union describing the current judging scope and the results
 * available within it.  Passed to {@link AwardPolicy} so the policy can
 * determine eligible award types or validate proposed choices without
 * knowing anything about entries.
 *
 * Variants follow the four FCI judging levels:
 * - `per-sex` — individual class results for one sex of a breed
 * - `breed`   — BOB/BOS competition drawing on per-sex title winners
 * - `group`   — Best-in-Group competition drawing on BOB winners
 * - `show`    — Best-in-Show competition drawing on BIG winners
 */
export type JudgingScopeResults =
    | {
          readonly kind: 'per-sex';
          /** All class placements from this sex's judging, across all classes. */
          readonly placements: ReadonlyArray<ClassPlacement>;
      }
    | {
          readonly kind: 'breed';
          /** CACIB/CACIB-J/CACIB-V candidates from male judging. */
          readonly maleCandidates: ReadonlyArray<CandidateEntry>;
          /** CACIB/CACIB-J/CACIB-V candidates from female judging. */
          readonly femaleCandidates: ReadonlyArray<CandidateEntry>;
      }
    | {
          readonly kind: 'group';
          /** Best-of-Breed candidates entering the group competition. */
          readonly bobCandidates: ReadonlyArray<CandidateEntry>;
      }
    | {
          readonly kind: 'show';
          /** Best-in-Group candidates entering the show competition. */
          readonly bigCandidates: ReadonlyArray<CandidateEntry>;
      };
