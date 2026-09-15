// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeId, AwardTypeId } from '../../shared/domain-ids.js';
import type { EntryRef } from '../collective-award-policy/entry-ref.js';
import type { Sex } from '../../model/effective-ruleset/value-objects/sex.js';

/**
 * A candidate dog within a {@link CandidateStream} — the opaque entry reference
 * and the grade the dog received from its feeder (an Award or a Class win). A
 * stream is expected to carry only its feeder's qualifying candidates (e.g. a
 * Class feeder's 1st-place dog) — a construction-time convention this type
 * does not itself enforce; the policy matcher checks only `gradeId` against
 * the higher-scope Award's `minimumGradeId` (ADR-0017).
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
function candidatesEqual(a: readonly StreamCandidate[], b: readonly StreamCandidate[]): boolean {
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
    readonly candidates: readonly StreamCandidate[];
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
    readonly candidates: readonly StreamCandidate[];

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
    readonly candidates: readonly StreamCandidate[];

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
