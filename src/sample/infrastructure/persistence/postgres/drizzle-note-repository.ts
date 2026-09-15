// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import type pg from 'pg';
import { asPrincipalId } from '../../../../Shared/index.js';
import { asNoteId, type NoteId } from '../../../domain/shared/domain-ids.js';
import { ConcurrentModificationError } from '../../../domain/shared/concurrent-modification-error.js';
import { notesTable } from './schema.js';
import { Note } from '../../../domain/model/note/note.js';
import type { NoteRepository } from '../../../domain/model/note/note-repository.js';
import { NotePersistenceFailed } from './note-persistence-failed.js';

export class DrizzleNoteRepository implements NoteRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findById(id: NoteId): Promise<Note | undefined> {
        try {
            const [row] = await this.drizzle.select().from(notesTable).where(eq(notesTable.id, id));
            return row === undefined
                ? undefined
                : Note.rehydrate({
                      id: asNoteId(row.id),
                      createdBy: asPrincipalId(row.principalId),
                      name: row.name,
                      version: row.version,
                  });
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new NotePersistenceFailed('reading a note', cause);
        }
    }

    async add(note: Note): Promise<void> {
        try {
            await this.drizzle.insert(notesTable).values({
                id: note.id,
                principalId: note.createdBy,
                name: note.name,
                version: note.version,
            });
        } catch (cause) {
            throw new NotePersistenceFailed('adding a note', cause);
        }
    }

    /** @throws {ConcurrentModificationError} when the stored version no longer matches `note.version`. */
    async update(note: Note): Promise<void> {
        try {
            const matchedRows = await this.drizzle
                .update(notesTable)
                .set({ name: note.name, version: note.version + 1 })
                .where(and(eq(notesTable.id, note.id), eq(notesTable.version, note.version)))
                .returning({ id: notesTable.id });
            if (matchedRows.length === 0) {
                throw new ConcurrentModificationError('Note', note.id, note.version);
            }
        } catch (cause) {
            if (cause instanceof ConcurrentModificationError) throw cause;
            throw new NotePersistenceFailed('updating a note', cause);
        }
    }
}
