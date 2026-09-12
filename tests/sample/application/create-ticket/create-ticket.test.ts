// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    asClubId,
    asPrincipalId,
    ClubEventScope,
    ClubTransactionScope,
    ExhibitorTransactionScope,
} from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateItemHandler } from '../../../../src/sample/application/create-item/create-item.js';
import { CreateTicketHandler } from '../../../../src/sample/application/create-ticket/create-ticket.js';
import { ItemNotFoundError } from '../../../../src/sample/domain/model/item/item.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const EXHIBITOR_ID = asPrincipalId('00000000-0000-4000-8000-000000000012');

describe('CreateTicketHandler', () => {
    it("creates a Ticket owned by the referenced Item's Club, even when the actor has no Club of their own", async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateItemHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000031', name: 'The Item' },
            ClubTransactionScope.of(CLUB_ID, CLUB_PRINCIPAL_ID),
        );

        const response = await new CreateTicketHandler(unitOfWork).execute(
            {
                id: '00000000-0000-4000-8000-000000000021',
                itemId: '00000000-0000-4000-8000-000000000031',
                name: 'A name',
            },
            ExhibitorTransactionScope.of(EXHIBITOR_ID),
        );

        expect(response).toEqual({ id: '00000000-0000-4000-8000-000000000021', name: 'A name' });
        const createdEvent = unitOfWork.recordedEvents.at(-1);
        expect(createdEvent?.type).toBe('sample.TicketCreated');
        expect(createdEvent?.scope).toEqual(ClubEventScope.of(CLUB_ID));
    });

    it('throws ItemNotFoundError when the referenced Item does not exist', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();

        await expect(
            new CreateTicketHandler(unitOfWork).execute(
                {
                    id: '00000000-0000-4000-8000-000000000021',
                    itemId: '00000000-0000-4000-8000-000000000099',
                    name: 'A name',
                },
                ExhibitorTransactionScope.of(EXHIBITOR_ID),
            ),
        ).rejects.toThrow(ItemNotFoundError);
    });
});
