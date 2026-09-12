// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Note } from './note.js';
import type { NoteId } from '../../shared/domain-ids.js';

/**
 * Persistence port for the Note aggregate.
 *
 * `add` is insert-only — a duplicate id fails loudly instead of silently
 * overwriting; changes go through `findById` → mutator → `update` (ADR-0026).
 */
export interface NoteRepository {
    findById(id: NoteId): Promise<Note | undefined>;
    add(note: Note): Promise<void>;
    update(note: Note): Promise<void>;
}
