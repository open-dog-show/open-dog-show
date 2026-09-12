// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, asPrincipalId, ClubTransactionScope } from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateItemHandler } from '../../../../src/sample/application/create-item/create-item.js';
import { RenameItemHandler } from '../../../../src/sample/application/rename-item/rename-item.js';
import {
    ItemNotFoundError,
    InvalidItemNameError,
} from '../../../../src/sample/domain/model/item/item.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const SCOPE = ClubTransactionScope.of(CLUB_ID, PRINCIPAL_ID);

describe('RenameItemHandler', () => {
    it('renames an existing Item', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateItemHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        const result = await new RenameItemHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: true,
            value: { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
        });
        expect(unitOfWork.recordedEvents.at(-1)?.type).toBe('sample.ItemRenamed');
    });

    it('returns ItemNotFoundError for an unknown id', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();

        const result = await new RenameItemHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000099', name: 'New name' },
            SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(ItemNotFoundError) });
    });

    it('returns InvalidItemNameError for a blank name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateItemHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        const result = await new RenameItemHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: '   ' },
            SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(InvalidItemNameError) });
    });
});
