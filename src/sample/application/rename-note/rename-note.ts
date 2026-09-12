// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Result, TransactionScope } from '../../../Shared/index.js';
import { asNoteId } from '../../domain/shared/domain-ids.js';
import { NoteNotFoundError, InvalidNoteNameError } from '../../domain/model/note/note.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link RenameNoteHandler.execute}. */
export interface RenameNoteCommand {
    /** Aggregate id of the Note to rename. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the renamed Note (B4). */
export interface RenameNoteResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: rename an existing Note and record the
 * `sample.NoteRenamed` fact in the same
 * transaction (ADR-0014).
 *
 * Ownership is not re-derived here — `findById` only returns a row the
 * caller's RLS-scoped connection can already see, so a successful lookup
 * already proves the caller may act on it; this is the one shared shape for
 * every ownership scope (ADR-0026).
 */
export class RenameNoteHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    async execute(
        command: RenameNoteCommand,
        scope: TransactionScope,
    ): Promise<Result<RenameNoteResponse, NoteNotFoundError | InvalidNoteNameError>> {
        try {
            return await this.unitOfWork.run<
                Result<RenameNoteResponse, NoteNotFoundError | InvalidNoteNameError>
            >(scope, async (ctx) => {
                const id = asNoteId(command.id);
                const note = await ctx.notes.findById(id);
                if (note === undefined) {
                    throw new NoteNotFoundError(id);
                }
                note.rename(command.name);
                await ctx.notes.update(note);
                return { ok: true, value: { id: note.id, name: note.name } };
            });
        } catch (error) {
            if (error instanceof NoteNotFoundError || error instanceof InvalidNoteNameError) {
                return { ok: false, error };
            }
            throw error;
        }
    }
}
