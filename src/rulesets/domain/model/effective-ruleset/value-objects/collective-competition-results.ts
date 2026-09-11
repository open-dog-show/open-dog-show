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
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * BreedVarietyRef.of} validating factory is the only construction path
 * (V2/V3). The fields carry no independent invariant of their own, so the
 * factory is a pass-through (mirrors {@link RoleScope}).
 */
export class BreedVarietyRef {
    readonly breedId: BreedId;
    readonly varietyId: VarietyId | undefined;

    private constructor(breedId: BreedId, varietyId: VarietyId | undefined) {
        this.breedId = breedId;
        this.varietyId = varietyId;
    }

    static of(breedId: BreedId, varietyId: VarietyId | undefined): BreedVarietyRef {
        return new BreedVarietyRef(breedId, varietyId);
    }

    equals(other: BreedVarietyRef): boolean {
        return this.breedId === other.breedId && this.varietyId === other.varietyId;
    }
}

/**
 * A single dog competing within a Collective Competition.
 * Sex is required because Brace/Couple mandates one of each.
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * CollectiveEntry.of} validating factory is the only construction path.
 */
export class CollectiveEntry {
    /** Opaque reference to the judged entry. */
    readonly entryRef: EntryRef;
    readonly sex: Sex;

    private constructor(entryRef: EntryRef, sex: Sex) {
        this.entryRef = entryRef;
        this.sex = sex;
    }

    static of(entryRef: EntryRef, sex: Sex): CollectiveEntry {
        return new CollectiveEntry(entryRef, sex);
    }

    equals(other: CollectiveEntry): boolean {
        return this.entryRef === other.entryRef && this.sex === other.sex;
    }
}

/**
 * The three FCI collective competition types.
 * Derived from the `kind` discriminant of {@link CollectiveCompetitionResults}
 * so the two never diverge.
 */
export type CollectiveCompetitionKind = CollectiveCompetitionResults['kind'];

/**
 * Value equality for a {@link CollectiveEntry} array — same length, and each
 * pair equal in order. Shared by every {@link CollectiveCompetitionResults}
 * variant's `equals` (mirrors `candidatesEqual` in
 * `judging-scope-results.ts`).
 */
function entriesEqual(
    a: ReadonlyArray<CollectiveEntry>,
    b: ReadonlyArray<CollectiveEntry>,
): boolean {
    if (a.length !== b.length) return false;
    return a.every((entry, i) => {
        const counterpart = b[i];
        return counterpart !== undefined && entry.equals(counterpart);
    });
}

/** Attributes for {@link BraceCoupleCompetitionResults.of}. */
export interface BraceCoupleCompetitionResultsAttributes {
    readonly breed: BreedVarietyRef;
    readonly entries: ReadonlyArray<CollectiveEntry>;
}

/**
 * `brace-couple` — one male + one female of the same breed/variety.
 *
 * A value object (ADR-0022): a **variant value object** — the three
 * collective-competition result kinds carry genuinely different fields
 * (`breed` vs `breed`+`kennelName` vs `parentEntryRef`), so each is its own
 * class rather than a single class with optional fields (mirrors
 * `TransactionScope`, ADR-0023). Private constructor plus the {@link
 * BraceCoupleCompetitionResults.of} factory is the only construction path.
 */
export class BraceCoupleCompetitionResults {
    readonly kind = 'brace-couple' as const;
    readonly breed: BreedVarietyRef;
    readonly entries: ReadonlyArray<CollectiveEntry>;

    private constructor(attributes: BraceCoupleCompetitionResultsAttributes) {
        this.breed = attributes.breed;
        this.entries = [...attributes.entries];
    }

    static of(attributes: BraceCoupleCompetitionResultsAttributes): BraceCoupleCompetitionResults {
        return new BraceCoupleCompetitionResults(attributes);
    }

    equals(other: BraceCoupleCompetitionResults): boolean {
        return this.breed.equals(other.breed) && entriesEqual(this.entries, other.entries);
    }
}

/** Attributes for {@link BreedersGroupCompetitionResults.of}. */
export interface BreedersGroupCompetitionResultsAttributes {
    readonly breed: BreedVarietyRef;
    /** Name of the kennel that bred all competing dogs. */
    readonly kennelName: string;
    readonly entries: ReadonlyArray<CollectiveEntry>;
}

/**
 * `breeders-group` — 3–5 dogs of the same breed/variety from one kennel.
 * See {@link BraceCoupleCompetitionResults} for the variant-value-object
 * rationale.
 */
export class BreedersGroupCompetitionResults {
    readonly kind = 'breeders-group' as const;
    readonly breed: BreedVarietyRef;
    readonly kennelName: string;
    readonly entries: ReadonlyArray<CollectiveEntry>;

    private constructor(attributes: BreedersGroupCompetitionResultsAttributes) {
        this.breed = attributes.breed;
        this.kennelName = attributes.kennelName;
        this.entries = [...attributes.entries];
    }

    static of(
        attributes: BreedersGroupCompetitionResultsAttributes,
    ): BreedersGroupCompetitionResults {
        return new BreedersGroupCompetitionResults(attributes);
    }

    equals(other: BreedersGroupCompetitionResults): boolean {
        return (
            this.breed.equals(other.breed) &&
            this.kennelName === other.kennelName &&
            entriesEqual(this.entries, other.entries)
        );
    }
}

/** Attributes for {@link ProgenyGroupCompetitionResults.of}. */
export interface ProgenyGroupCompetitionResultsAttributes {
    /** Opaque reference to the sire or dam whose offspring are competing. */
    readonly parentEntryRef: EntryRef;
    readonly entries: ReadonlyArray<CollectiveEntry>;
}

/**
 * `progeny-group` — a sire or dam with 3–5 first-generation offspring.
 * See {@link BraceCoupleCompetitionResults} for the variant-value-object
 * rationale.
 */
export class ProgenyGroupCompetitionResults {
    readonly kind = 'progeny-group' as const;
    readonly parentEntryRef: EntryRef;
    readonly entries: ReadonlyArray<CollectiveEntry>;

    private constructor(attributes: ProgenyGroupCompetitionResultsAttributes) {
        this.parentEntryRef = attributes.parentEntryRef;
        this.entries = [...attributes.entries];
    }

    static of(
        attributes: ProgenyGroupCompetitionResultsAttributes,
    ): ProgenyGroupCompetitionResults {
        return new ProgenyGroupCompetitionResults(attributes);
    }

    equals(other: ProgenyGroupCompetitionResults): boolean {
        return (
            this.parentEntryRef === other.parentEntryRef &&
            entriesEqual(this.entries, other.entries)
        );
    }
}

/**
 * The result of a Collective Competition: a discriminated union over the
 * three FCI collective competition types and the dogs participating in each.
 */
export type CollectiveCompetitionResults =
    | BraceCoupleCompetitionResults
    | BreedersGroupCompetitionResults
    | ProgenyGroupCompetitionResults;
