// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    AggregateRoot,
    asAggregateId,
    ExhibitorEventScope,
    DomainError,
    type PrincipalId,
} from '../../../../Shared/index.js';
import type { NoteId } from '../../shared/domain-ids.js';
import { NoteCreated } from './events/note-created.js';
import { NoteRenamed } from './events/note-renamed.js';

/**
 * A Note — an exhibitor-scoped placeholder aggregate generated
 * by `new:aggregate --scope exhibitor` (ADR-0025/0026/0027).
 *
 * Modelled as a class aggregate extending {@link AggregateRoot}: unlike a
 * club-scoped aggregate, a Note carries no `clubId` at all —
 * it is owned solely by the acting exhibitor (`createdBy`), and both
 * {@link create} and {@link rename} record their own fact, scoped to that
 * exhibitor (`ExhibitorEventScope`, ADR-0027). A private `#brand` field makes
 * the class **nominal** so a bare `{ id, createdBy, … }` object literal is
 * not assignable to `Note` — the type is closed against
 * unvalidated construction. Storage load goes through
 * {@link Note.rehydrate}, which does not record an event.
 */
export class Note extends AggregateRoot {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `Note` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;
    #name: string;

    readonly id: NoteId;
    readonly createdBy: PrincipalId;

    get name(): string {
        return this.#name;
    }

    private constructor(id: NoteId, createdBy: PrincipalId, name: string) {
        super();
        this.id = id;
        this.createdBy = createdBy;
        this.#name = name;
    }

    /** Creates a new Note, recording `NoteCreated` scoped to the acting exhibitor. */
    static create(input: {
        readonly id: NoteId;
        readonly createdBy: PrincipalId;
        readonly name: string;
    }): Note {
        assertNoteName(input.name);
        const note = new Note(input.id, input.createdBy, input.name);
        note.record(
            NoteCreated.create(asAggregateId(note.id), ExhibitorEventScope.of(note.createdBy), {
                name: note.name,
            }),
        );
        return note;
    }

    /**
     * Rehydrates a Note from storage. No event is recorded —
     * rehydration replays past state, it does not produce a new fact.
     */
    static rehydrate(input: {
        readonly id: NoteId;
        readonly createdBy: PrincipalId;
        readonly name: string;
    }): Note {
        return new Note(input.id, input.createdBy, input.name);
    }

    /** Renames this Note, recording `NoteRenamed` scoped to the acting exhibitor. */
    rename(name: string): void {
        assertNoteName(name);
        this.#name = name;
        this.record(
            NoteRenamed.create(asAggregateId(this.id), ExhibitorEventScope.of(this.createdBy), {
                name,
            }),
        );
    }
}

function assertNoteName(name: string): void {
    if (name.trim().length === 0) {
        throw new InvalidNoteNameError(name);
    }
}

/** Thrown by {@link Note.create} / {@link Note.rename} for a blank name. */
export class InvalidNoteNameError extends DomainError {
    constructor(name: string) {
        super(`Note name must not be blank (got '${name}')`, { name });
    }
}

/** Thrown when a use case looks up a Note by id and none exists — e.g. `RenameNoteHandler`. */
export class NoteNotFoundError extends DomainError {
    readonly id: NoteId;

    constructor(id: NoteId) {
        super(`No Note found with id '${id}'`, { id });
        this.id = id;
    }
}
