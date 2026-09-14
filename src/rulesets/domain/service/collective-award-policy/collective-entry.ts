// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { EntryRef } from './entry-ref.js';
import type { Sex } from '../../model/effective-ruleset/value-objects/sex.js';

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
