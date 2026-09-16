// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeId } from '../../shared/domain-ids.js';
import type { EntryRef } from '../collective-award-policy/entry-ref.js';
import type { Placement } from './placement.js';
import type { CandidateStream } from './candidate-stream.js';

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
 * pair equal in order. Mirrors `candidatesEqual` in `candidate-stream.ts`.
 */
function placementsEqual(a: readonly ClassPlacement[], b: readonly ClassPlacement[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((placement, i) => {
        const counterpart = b[i];
        return counterpart !== undefined && placement.equals(counterpart);
    });
}

/** Attributes for {@link PerSexJudgingScopeResults.of}. */
export interface PerSexJudgingScopeResultsAttributes {
    /** All class placements from this sex's judging, across all classes. */
    readonly placements: readonly ClassPlacement[];
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
    readonly placements: readonly ClassPlacement[];

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
    readonly streams: readonly CandidateStream[];

    private constructor(kind: HigherScopeJudgingScopeKind, streams: readonly CandidateStream[]) {
        this.kind = kind;
        this.streams = [...streams];
    }

    static breed(streams: readonly CandidateStream[]): HigherScopeJudgingScopeResults {
        return new HigherScopeJudgingScopeResults('breed', streams);
    }

    static group(streams: readonly CandidateStream[]): HigherScopeJudgingScopeResults {
        return new HigherScopeJudgingScopeResults('group', streams);
    }

    static show(streams: readonly CandidateStream[]): HigherScopeJudgingScopeResults {
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
