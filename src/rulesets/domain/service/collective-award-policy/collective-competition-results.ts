// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { EntryRef } from './entry-ref.js';
import type { BreedVarietyRef } from './breed-variety-ref.js';
import type { CollectiveEntry } from './collective-entry.js';

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
function entriesEqual(a: readonly CollectiveEntry[], b: readonly CollectiveEntry[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((entry, i) => {
        const counterpart = b[i];
        return counterpart !== undefined && entry.equals(counterpart);
    });
}

/** Attributes for {@link BraceCoupleCompetitionResults.of}. */
export interface BraceCoupleCompetitionResultsAttributes {
    readonly breed: BreedVarietyRef;
    readonly entries: readonly CollectiveEntry[];
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
    readonly entries: readonly CollectiveEntry[];

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
    readonly entries: readonly CollectiveEntry[];
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
    readonly entries: readonly CollectiveEntry[];

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
    readonly entries: readonly CollectiveEntry[];
}

/**
 * `progeny-group` — a sire or dam with 3–5 first-generation offspring.
 * See {@link BraceCoupleCompetitionResults} for the variant-value-object
 * rationale.
 */
export class ProgenyGroupCompetitionResults {
    readonly kind = 'progeny-group' as const;
    readonly parentEntryRef: EntryRef;
    readonly entries: readonly CollectiveEntry[];

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
