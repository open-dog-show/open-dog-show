// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asPrincipalId, ExhibitorTransactionScope } from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateNoteHandler } from '../../../../src/sample/application/create-note/create-note.js';
import { InvalidNoteNameError } from '../../../../src/sample/domain/model/note/note.js';

const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const SCOPE = ExhibitorTransactionScope.of(PRINCIPAL_ID);

describe('CreateNoteHandler', () => {
    it('creates a Note owned by the acting exhibitor', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const handler = new CreateNoteHandler(unitOfWork);

        const result = await handler.execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'A name' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: true,
            value: { id: '00000000-0000-4000-8000-000000000021', name: 'A name' },
        });
        expect(unitOfWork.recordedEvents).toHaveLength(1);
        expect(unitOfWork.recordedEvents[0]?.type).toBe('sample.NoteCreated');
    });

    it('returns InvalidNoteNameError for a blank name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const handler = new CreateNoteHandler(unitOfWork);

        const result = await handler.execute(
            { id: '00000000-0000-4000-8000-000000000021', name: '   ' },
            SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(InvalidNoteNameError) });
        expect(unitOfWork.recordedEvents).toHaveLength(0);
    });
});
