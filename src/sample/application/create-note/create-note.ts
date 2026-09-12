// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { requireActor, type TransactionScope } from '../../../Shared/index.js';
import { asNoteId } from '../../domain/shared/domain-ids.js';
import { Note } from '../../domain/model/note/note.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link CreateNoteHandler.execute} that are not derivable from the transaction scope. */
export interface CreateNoteCommand {
    /** Aggregate id of the Note to create. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the created Note (B4). */
export interface CreateNoteResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: create a Note — owned solely by the acting
 * exhibitor, with no Club at all — and record the
 * `sample.NoteCreated` fact in the same
 * transaction (ADR-0014).
 */
export class CreateNoteHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * @throws {ScopeMismatchError} when `scope` has no acting principal (a
     *   `platform` scope) — see {@link requireActor}.
     */
    async execute(
        command: CreateNoteCommand,
        scope: TransactionScope,
    ): Promise<CreateNoteResponse> {
        const createdBy = requireActor(scope);
        return this.unitOfWork.run(scope, async (ctx) => {
            const note = Note.create({
                id: asNoteId(command.id),
                createdBy,
                name: command.name,
            });
            await ctx.notes.add(note);
            return { id: note.id, name: note.name };
        });
    }
}
