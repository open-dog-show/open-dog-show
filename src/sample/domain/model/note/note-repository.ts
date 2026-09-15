// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Note } from './note.js';
import type { NoteId } from '../../shared/domain-ids.js';

/**
 * Persistence port for the Note aggregate.
 *
 * `add` is insert-only — a duplicate id fails loudly instead of silently
 * overwriting; changes go through `findById` → mutator → `update` (ADR-0026).
 * Both generated implementations of `update` (Drizzle, in-memory fake) check
 * the aggregate's `version` and throw `ConcurrentModificationError`
 * (`../../shared/concurrent-modification-error.js`) on a mismatch, so a
 * concurrent write between load and save is never silently clobbered — a
 * hand-written third implementation of this port is responsible for the same
 * check to keep that guarantee.
 */
export interface NoteRepository {
    findById(id: NoteId): Promise<Note | undefined>;
    add(note: Note): Promise<void>;
    /** @throws {ConcurrentModificationError} when the stored version no longer matches `note.version`. */
    update(note: Note): Promise<void>;
}
