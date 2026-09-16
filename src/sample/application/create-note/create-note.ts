// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { requireActor, type Result, type TransactionScope } from '../../../Shared/index.js';
import { asNoteId } from '../../domain/shared/domain-ids.js';
import { Note, InvalidNoteNameError } from '../../domain/model/note/note.js';
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
     *   `platform` scope) — see {@link requireActor}. A technical fault
     *   (E4/E6), not part of the `Result` channel, so it is rethrown rather
     *   than caught below.
     */
    async execute(
        command: CreateNoteCommand,
        scope: TransactionScope,
    ): Promise<Result<CreateNoteResponse, InvalidNoteNameError>> {
        const createdBy = requireActor(scope);
        // This construct-then-save shape repeats near-identically across the
        // 4 scope variants of every create-*.ts.hbs template — tracked in
        // #216 (four-scope template duplication), not fixed here.
        // create-hybrid.ts.hbs is the one variant that keeps validation
        // inside the transaction instead — see its createInTransaction doc
        // comment for why.
        let note: Note;
        try {
            note = Note.create({
                id: asNoteId(command.id),
                createdBy,
                name: command.name,
            });
        } catch (error) {
            if (error instanceof InvalidNoteNameError) {
                return { ok: false, error };
            }
            throw error;
        }
        await this.unitOfWork.run(scope, async (ctx) => {
            await ctx.notes.add(note);
        });
        return { ok: true, value: { id: note.id, name: note.name } };
    }
}
