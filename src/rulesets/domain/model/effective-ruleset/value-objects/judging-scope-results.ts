// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeId, AwardTypeId } from './domain-ids.js';
import type { EntryRef } from './entry-ref.js';
import type { Sex } from './sex.js';
import type { Placement } from './placement.js';

/** Attributes for {@link ClassPlacement.of}. */
export interface ClassPlacementAttributes {
    readonly classId: ClassId;
    readonly entryRef: EntryRef;
    readonly gradeId: GradeId;
    readonly placement: Placement | undefined;
}

/**
 * A single dog's result within a per-sex class judging — the grade the judge
 * awarded and the ordinal placement within the class.
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * ClassPlacement.of} validating factory is the only construction path
 * (V2/V3). The fields carry no independent invariant of their own, so the
 * factory is a pass-through (mirrors {@link RoleScope}).
 */
export class ClassPlacement {
    readonly classId: ClassId;
    readonly entryRef: EntryRef;
    readonly gradeId: GradeId;
    readonly placement: Placement | undefined;

    private constructor(attributes: ClassPlacementAttributes) {
        this.classId = attributes.classId;
        this.entryRef = attributes.entryRef;
        this.gradeId = attributes.gradeId;
        this.placement = attributes.placement;
    }

    static of(attributes: ClassPlacementAttributes): ClassPlacement {
        return new ClassPlacement(attributes);
    }

    equals(other: ClassPlacement): boolean {
        return (
            this.classId === other.classId &&
            this.entryRef === other.entryRef &&
            this.gradeId === other.gradeId &&
            this.placement === other.placement
        );
    }
}

/**
 * A candidate dog within a {@link CandidateStream} — the opaque entry reference
 * and the grade the dog received from its feeder (an Award or a Class win).
 * The policy matcher checks only `gradeId` against the higher-scope Award's
 * `minimumGradeId`; picking the 1st-place dog is a construction-time filter in
 * the Judging context, not a policy check (ADR-0017).
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * StreamCandidate.of} validating factory is the only construction path.
 */
export class StreamCandidate {
    readonly entryRef: EntryRef;
    readonly gradeId: GradeId;

    private constructor(entryRef: EntryRef, gradeId: GradeId) {
        this.entryRef = entryRef;
        this.gradeId = gradeId;
    }

    static of(entryRef: EntryRef, gradeId: GradeId): StreamCandidate {
        return new StreamCandidate(entryRef, gradeId);
    }

    equals(other: StreamCandidate): boolean {
        return this.entryRef === other.entryRef && this.gradeId === other.gradeId;
    }
}

/**
 * Value equality for a {@link StreamCandidate} array — same length, and each
 * pair equal in order. Shared by {@link AwardFeederStream.equals} and {@link
 * ClassFeederStream.equals} so the pairwise-compare-without-an-unsafe-cast
 * logic lives in one place.
 */
function candidatesEqual(
    a: ReadonlyArray<StreamCandidate>,
    b: ReadonlyArray<StreamCandidate>,
): boolean {
    if (a.length !== b.length) return false;
    return a.every((candidate, i) => {
        const counterpart = b[i];
        return counterpart !== undefined && candidate.equals(counterpart);
    });
}

/** Attributes shared by {@link AwardFeederStream.of} / {@link ClassFeederStream.of} — the feeder key aside. */
interface CandidateStreamAttributesBase {
    /** Sex tag — breed scope only (male/female streams for BOB/BOS); undefined at group/show. */
    readonly sex: Sex | undefined;
    /** The candidate dogs this feeder supplies, each with its feeder grade. */
    readonly candidates: ReadonlyArray<StreamCandidate>;
}

/** Attributes for {@link AwardFeederStream.of}. */
export interface AwardFeederStreamAttributes extends CandidateStreamAttributesBase {
    /** The Award Type that qualifies these candidates. */
    readonly feederAwardTypeId: AwardTypeId;
}

/**
 * A stream fed by an {@link AwardType} (e.g. CACIB feeds BOB; BIG feeds BIS)
 * (ADR-0017).
 *
 * A value object (ADR-0022): a **variant value object** — {@link
 * AwardFeederStream} and {@link ClassFeederStream} carry different fields
 * (`feederAwardTypeId` vs `feederClassId`), so each is its own class rather
 * than a single class with optional fields (mirrors `TransactionScope`,
 * ADR-0023). Private constructor plus the {@link AwardFeederStream.of}
 * factory is the only construction path.
 */
export class AwardFeederStream {
    readonly kind = 'award' as const;
    readonly feederAwardTypeId: AwardTypeId;
    readonly sex: Sex | undefined;
    readonly candidates: ReadonlyArray<StreamCandidate>;

    private constructor(attributes: AwardFeederStreamAttributes) {
        this.feederAwardTypeId = attributes.feederAwardTypeId;
        this.sex = attributes.sex;
        this.candidates = [...attributes.candidates];
    }

    static of(attributes: AwardFeederStreamAttributes): AwardFeederStream {
        return new AwardFeederStream(attributes);
    }

    equals(other: AwardFeederStream): boolean {
        return (
            this.feederAwardTypeId === other.feederAwardTypeId &&
            this.sex === other.sex &&
            candidatesEqual(this.candidates, other.candidates)
        );
    }
}

/** Attributes for {@link ClassFeederStream.of}. */
export interface ClassFeederStreamAttributes extends CandidateStreamAttributesBase {
    /** The Class whose 1st-place win qualifies these candidates. */
    readonly feederClassId: ClassId;
}

/**
 * A stream fed by a Class placement (e.g. the Puppy class 1st feeds Best
 * Puppy) (ADR-0017). See {@link AwardFeederStream} for the variant-value-object
 * rationale.
 */
export class ClassFeederStream {
    readonly kind = 'class' as const;
    readonly feederClassId: ClassId;
    readonly sex: Sex | undefined;
    readonly candidates: ReadonlyArray<StreamCandidate>;

    private constructor(attributes: ClassFeederStreamAttributes) {
        this.feederClassId = attributes.feederClassId;
        this.sex = attributes.sex;
        this.candidates = [...attributes.candidates];
    }

    static of(attributes: ClassFeederStreamAttributes): ClassFeederStream {
        return new ClassFeederStream(attributes);
    }

    equals(other: ClassFeederStream): boolean {
        return (
            this.feederClassId === other.feederClassId &&
            this.sex === other.sex &&
            candidatesEqual(this.candidates, other.candidates)
        );
    }
}

/**
 * A feeder-keyed stream of candidate dogs for a higher-scope Award
 * (ADR-0017). A stream is either an {@link AwardFeederStream} (fed by an
 * Award Type) or a {@link ClassFeederStream} (fed by a Class placement); each
 * member requires exactly one feeder key. An optional `sex` tag (breed scope
 * only) separates male/female streams for BOB/BOS; group/show awards are not
 * sex-split, so their streams carry `sex: undefined`.
 *
 * A {@link JudgingScopeResults} breed/group/show variant carries a flat list of
 * these streams; the Award Policy matches each higher-scope Award's `fedBy`
 * against the streams by feeder key (and `sex` at breed scope).
 */
export type CandidateStream = AwardFeederStream | ClassFeederStream;

/**
 * Value equality for a {@link CandidateStream} pair — narrows both sides on
 * `kind` before delegating to the variant's own `equals` (mirrors
 * `transactionScopesEqual` in `src/Shared/domain/transaction-scope.ts`).
 */
function candidateStreamEquals(a: CandidateStream, b: CandidateStream): boolean {
    if (a.kind === 'award' && b.kind === 'award') return a.equals(b);
    if (a.kind === 'class' && b.kind === 'class') return a.equals(b);
    return false;
}

/**
 * Value equality for a {@link ClassPlacement} array — same length, and each
 * pair equal in order. Mirrors {@link candidatesEqual}.
 */
function placementsEqual(
    a: ReadonlyArray<ClassPlacement>,
    b: ReadonlyArray<ClassPlacement>,
): boolean {
    if (a.length !== b.length) return false;
    return a.every((placement, i) => {
        const counterpart = b[i];
        return counterpart !== undefined && placement.equals(counterpart);
    });
}

/** Attributes for {@link PerSexJudgingScopeResults.of}. */
export interface PerSexJudgingScopeResultsAttributes {
    /** All class placements from this sex's judging, across all classes. */
    readonly placements: ReadonlyArray<ClassPlacement>;
}

/**
 * `per-sex` scope — individual class results for one sex of a breed.
 *
 * A value object (ADR-0022): a **variant value object** — {@link
 * PerSexJudgingScopeResults} carries `placements`, a genuinely different
 * field from {@link HigherScopeJudgingScopeResults}'s `streams`, so it is its
 * own class rather than a single class with optional fields (mirrors
 * `TransactionScope`, ADR-0023).
 */
export class PerSexJudgingScopeResults {
    readonly kind = 'per-sex' as const;
    readonly placements: ReadonlyArray<ClassPlacement>;

    private constructor(attributes: PerSexJudgingScopeResultsAttributes) {
        this.placements = [...attributes.placements];
    }

    static of(attributes: PerSexJudgingScopeResultsAttributes): PerSexJudgingScopeResults {
        return new PerSexJudgingScopeResults(attributes);
    }

    equals(other: PerSexJudgingScopeResults): boolean {
        return placementsEqual(this.placements, other.placements);
    }
}

/** The higher-scope judging levels — breed, group, and show all carry the same `{ kind, streams }` shape. */
export type HigherScopeJudgingScopeKind = 'breed' | 'group' | 'show';

/**
 * `breed` / `group` / `show` scope — the higher FCI judging levels, each fed
 * by its own feeder-keyed {@link CandidateStream}s (ADR-0017):
 * - `breed` — BOB/BOS competition drawing on per-sex title winners
 * - `group` — Best-in-Group competition drawing on BOB winners
 * - `show`  — Best-in-Show / Best Junior / Veteran / Puppy / Minor Puppy,
 *             each fed by its own feeder-keyed stream
 *
 * A value object (ADR-0022): the three levels share one shape (`{ kind,
 * streams }`, only `kind` differs), so — per the harness "same shape,
 * multiple factories" rule (mirrors `RoleScope`/`EventScope`, ADR-0023) —
 * they are **one** class with three named factories ({@link
 * HigherScopeJudgingScopeResults.breed} / {@link
 * HigherScopeJudgingScopeResults.group} / {@link
 * HigherScopeJudgingScopeResults.show}), not three near-identical classes.
 * Named to mirror {@link HigherScopeAwardType}, which covers the same three
 * scope levels for Award Types.
 */
export class HigherScopeJudgingScopeResults {
    readonly kind: HigherScopeJudgingScopeKind;
    readonly streams: ReadonlyArray<CandidateStream>;

    private constructor(
        kind: HigherScopeJudgingScopeKind,
        streams: ReadonlyArray<CandidateStream>,
    ) {
        this.kind = kind;
        this.streams = [...streams];
    }

    static breed(streams: ReadonlyArray<CandidateStream>): HigherScopeJudgingScopeResults {
        return new HigherScopeJudgingScopeResults('breed', streams);
    }

    static group(streams: ReadonlyArray<CandidateStream>): HigherScopeJudgingScopeResults {
        return new HigherScopeJudgingScopeResults('group', streams);
    }

    static show(streams: ReadonlyArray<CandidateStream>): HigherScopeJudgingScopeResults {
        return new HigherScopeJudgingScopeResults('show', streams);
    }

    equals(other: HigherScopeJudgingScopeResults): boolean {
        return (
            this.kind === other.kind &&
            this.streams.length === other.streams.length &&
            this.streams.every((s, i) => {
                const counterpart = other.streams[i];
                return counterpart !== undefined && candidateStreamEquals(s, counterpart);
            })
        );
    }
}

/**
 * Discriminated union describing the current judging scope and the results
 * available within it. Passed to {@link AwardPolicy} so the policy can
 * determine eligible award types or validate proposed choices without
 * knowing anything about entries.
 *
 * Variants follow the four FCI judging levels: {@link
 * PerSexJudgingScopeResults} (`per-sex`) and {@link
 * HigherScopeJudgingScopeResults} (`breed` / `group` / `show`).
 */
export type JudgingScopeResults = PerSexJudgingScopeResults | HigherScopeJudgingScopeResults;
