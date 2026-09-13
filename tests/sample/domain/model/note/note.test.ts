// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asPrincipalId, ExhibitorEventScope } from '../../../../../src/Shared/index.js';
import { Note, InvalidNoteNameError } from '../../../../../src/sample/domain/model/note/note.js';
import { asNoteId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const NOTE_ID = asNoteId('00000000-0000-4000-8000-000000000021');

describe('Note', () => {
    it('create records NoteCreated scoped to the acting exhibitor', () => {
        const note = Note.create({
            id: NOTE_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Original name',
        });

        const [event] = note.pullEvents();
        expect(event?.type).toBe('sample.NoteCreated');
        expect(event?.scope).toEqual(ExhibitorEventScope.of(PRINCIPAL_ID));
        expect(event?.payload).toEqual({ name: 'Original name' });
        expect(note.name).toBe('Original name');
    });

    it('create rejects a blank name', () => {
        expect(() => Note.create({ id: NOTE_ID, createdBy: PRINCIPAL_ID, name: '   ' })).toThrow(
            InvalidNoteNameError,
        );
    });

    it('rehydrate does not record an event', () => {
        const note = Note.rehydrate({
            id: NOTE_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Restored name',
        });

        expect(note.pullEvents()).toEqual([]);
        expect(note.name).toBe('Restored name');
    });

    it('rename records NoteRenamed and updates the name', () => {
        const note = Note.rehydrate({
            id: NOTE_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Old name',
        });

        note.rename('New name');

        const [event] = note.pullEvents();
        expect(event?.type).toBe('sample.NoteRenamed');
        expect(event?.scope).toEqual(ExhibitorEventScope.of(PRINCIPAL_ID));
        expect(event?.payload).toEqual({ name: 'New name' });
        expect(note.name).toBe('New name');
    });

    it('rename rejects a blank name', () => {
        const note = Note.rehydrate({
            id: NOTE_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Old name',
        });

        expect(() => note.rename('')).toThrow(InvalidNoteNameError);
    });
});
