// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asPrincipalId, ExhibitorTransactionScope } from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateNoteHandler } from '../../../../src/sample/application/create-note/create-note.js';
import { RenameNoteHandler } from '../../../../src/sample/application/rename-note/rename-note.js';
import {
    NoteNotFoundError,
    InvalidNoteNameError,
} from '../../../../src/sample/domain/model/note/note.js';

const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const SCOPE = ExhibitorTransactionScope.of(PRINCIPAL_ID);

describe('RenameNoteHandler', () => {
    it('renames an existing Note', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateNoteHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        const result = await new RenameNoteHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: true,
            value: { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
        });
        expect(unitOfWork.recordedEvents.at(-1)?.type).toBe('sample.NoteRenamed');
    });

    it('returns NoteNotFoundError for an unknown id', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();

        const result = await new RenameNoteHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000099', name: 'New name' },
            SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(NoteNotFoundError) });
    });

    it('returns InvalidNoteNameError for a blank name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateNoteHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        const result = await new RenameNoteHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: '   ' },
            SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(InvalidNoteNameError) });
    });
});
