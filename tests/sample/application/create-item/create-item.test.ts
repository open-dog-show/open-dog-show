// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, asPrincipalId, ClubTransactionScope } from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateItemHandler } from '../../../../src/sample/application/create-item/create-item.js';
import { InvalidItemNameError } from '../../../../src/sample/domain/model/item/item.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const SCOPE = ClubTransactionScope.of(CLUB_ID, PRINCIPAL_ID);

describe('CreateItemHandler', () => {
    it('creates an Item owned by the acting Club', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const handler = new CreateItemHandler(unitOfWork);

        const result = await handler.execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'A name' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: true,
            value: { id: '00000000-0000-4000-8000-000000000021', name: 'A name' },
        });
        expect(unitOfWork.recordedEvents).toHaveLength(1);
        expect(unitOfWork.recordedEvents[0]?.type).toBe('sample.ItemCreated');
    });

    it('returns InvalidItemNameError for a blank name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const handler = new CreateItemHandler(unitOfWork);

        const result = await handler.execute(
            { id: '00000000-0000-4000-8000-000000000021', name: '   ' },
            SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(InvalidItemNameError) });
        expect(unitOfWork.recordedEvents).toHaveLength(0);
    });
});
