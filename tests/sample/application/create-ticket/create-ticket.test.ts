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
import { InvalidTicketNameError } from '../../../../src/sample/domain/model/ticket/ticket.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const EXHIBITOR_ID = asPrincipalId('00000000-0000-4000-8000-000000000012');
const EXHIBITOR_SCOPE = ExhibitorTransactionScope.of(EXHIBITOR_ID);

async function seedItem(unitOfWork: FakeSampleUnitOfWork): Promise<void> {
    await new CreateItemHandler(unitOfWork).execute(
        { id: '00000000-0000-4000-8000-000000000031', name: 'The Item' },
        ClubTransactionScope.of(CLUB_ID, CLUB_PRINCIPAL_ID),
    );
}

describe('CreateTicketHandler', () => {
    it("creates a Ticket owned by the referenced Item's Club, even when the actor has no Club of their own", async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await seedItem(unitOfWork);

        const result = await new CreateTicketHandler(unitOfWork).execute(
            {
                id: '00000000-0000-4000-8000-000000000021',
                itemId: '00000000-0000-4000-8000-000000000031',
                name: 'A name',
            },
            EXHIBITOR_SCOPE,
        );

        expect(result).toEqual({
            ok: true,
            value: { id: '00000000-0000-4000-8000-000000000021', name: 'A name' },
        });
        const createdEvent = unitOfWork.recordedEvents.at(-1);
        expect(createdEvent?.type).toBe('sample.TicketCreated');
        expect(createdEvent?.scope).toEqual(ClubEventScope.of(CLUB_ID));
    });

    it('returns ItemNotFoundError when the referenced Item does not exist', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();

        const result = await new CreateTicketHandler(unitOfWork).execute(
            {
                id: '00000000-0000-4000-8000-000000000021',
                itemId: '00000000-0000-4000-8000-000000000099',
                name: 'A name',
            },
            EXHIBITOR_SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(ItemNotFoundError) });
        expect(unitOfWork.recordedEvents).toHaveLength(0);
    });

    it('returns InvalidTicketNameError for a blank name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await seedItem(unitOfWork);

        const result = await new CreateTicketHandler(unitOfWork).execute(
            {
                id: '00000000-0000-4000-8000-000000000021',
                itemId: '00000000-0000-4000-8000-000000000031',
                name: '   ',
            },
            EXHIBITOR_SCOPE,
        );

        expect(result).toEqual({ ok: false, error: expect.any(InvalidTicketNameError) });
    });
});
