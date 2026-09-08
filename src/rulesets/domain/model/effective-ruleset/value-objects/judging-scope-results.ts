// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeId, AwardTypeId } from './domain-ids.js';
import type { EntryRef } from './entry-ref.js';

/**
 * A single dog's result within a per-sex class judging — the grade the judge
 * awarded and the ordinal placement within the class.
 */
export interface ClassPlacement {
    /** The class in which this dog was judged. */
    readonly classId: ClassId;
    /** Opaque reference to the judged entry (opaque to the Rulesets context). */
    readonly dogRef: EntryRef;
    /** Grade awarded by the judge. */
    readonly gradeId: GradeId;
    /**
     * Ordinal placement within the class (1 = first, 2 = second, …).
     * Undefined when the dog received a grade below the placeable threshold.
     */
    readonly placement: number | undefined;
}

/**
 * A candidate dog within a {@link CandidateStream} — the opaque entry reference
 * and the grade the dog received from its feeder (an Award or a Class win).
 * The policy matcher checks only `gradeId` against the higher-scope Award's
 * `minimumGradeId`; picking the 1st-place dog is a construction-time filter in
 * the Judging context, not a policy check (ADR-0017).
 */
export interface StreamCandidate {
    /** Opaque reference to the judged entry (opaque to the Rulesets context). */
    readonly dogRef: EntryRef;
    /** Grade the dog received from its feeder. */
    readonly gradeId: GradeId;
}

/**
 * A feeder-keyed stream of candidate dogs for a higher-scope Award
 * (ADR-0017). A stream is either an {@link AwardFeederStream} (fed by an
 * Award Type) or a {@link ClassFeederStream} (fed by a Class placement) — the
 * discriminated union enforces that exactly one feeder key is present, so an
 * ambiguous stream (both keys, or neither) cannot be constructed. An optional
 * `sex` tag (breed scope only) separates male/female streams for BOB/BOS;
 * group/show awards are not sex-split, so their streams carry `sex: undefined`.
 *
 * A {@link JudgingScopeResults} breed/group/show variant carries a flat list of
 * these streams; the Award Policy matches each higher-scope Award's `fedBy`
 * against the streams by feeder key (and `sex` at breed scope).
 */
export type CandidateStream = AwardFeederStream | ClassFeederStream;

interface CandidateStreamBase {
    /** Sex tag — breed scope only (male/female streams for BOB/BOS); undefined at group/show. */
    readonly sex: 'male' | 'female' | undefined;
    /** The candidate dogs this feeder supplies, each with its feeder grade. */
    readonly candidates: ReadonlyArray<StreamCandidate>;
}

/** A stream fed by an {@link AwardType} (e.g. CACIB feeds BOB; BIG feeds BIS). */
export interface AwardFeederStream extends CandidateStreamBase {
    /** The Award Type that qualifies these candidates. */
    readonly feederAwardTypeId: AwardTypeId;
}

/** A stream fed by a Class placement (e.g. the Puppy class 1st feeds Best Puppy). */
export interface ClassFeederStream extends CandidateStreamBase {
    /** The Class whose 1st-place win qualifies these candidates. */
    readonly feederClassId: ClassId;
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
 * - `show`    — Best-in-Show / Best Junior / Veteran / Puppy / Minor Puppy,
 *               each fed by its own feeder-keyed {@link CandidateStream}
 *
 * The breed/group/show variants each carry `streams: ReadonlyArray<CandidateStream>`
 * (ADR-0017) — one stream per in-scope Feeder — replacing the former named
 * candidate bags.
 */
export type JudgingScopeResults =
    | {
          readonly kind: 'per-sex';
          /** All class placements from this sex's judging, across all classes. */
          readonly placements: ReadonlyArray<ClassPlacement>;
      }
    | {
          readonly kind: 'breed';
          /**
           * Feeder-keyed candidate streams from both sexes — e.g. sex-tagged
           * CACIB (and/or CAC) streams plus sex-tagged junior/veteran class-win
           * streams. BOB/BOS eligibility requires a qualifying male and female.
           */
          readonly streams: ReadonlyArray<CandidateStream>;
      }
    | {
          readonly kind: 'group';
          /** Best-of-Breed feeder streams entering the group competition. */
          readonly streams: ReadonlyArray<CandidateStream>;
      }
    | {
          readonly kind: 'show';
          /**
           * Feeder streams entering the show competition — one per in-scope
           * feeder (BIG winners; junior/veteran/puppy/minor-puppy class wins).
           */
          readonly streams: ReadonlyArray<CandidateStream>;
      };
