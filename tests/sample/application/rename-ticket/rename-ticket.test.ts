// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
} from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateItemHandler } from '../../../../src/sample/application/create-item/create-item.js';
import { CreateTicketHandler } from '../../../../src/sample/application/create-ticket/create-ticket.js';
import { RenameTicketHandler } from '../../../../src/sample/application/rename-ticket/rename-ticket.js';
import { TicketNotFoundError } from '../../../../src/sample/domain/model/ticket/ticket.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const EXHIBITOR_ID = asPrincipalId('00000000-0000-4000-8000-000000000012');
const EXHIBITOR_SCOPE = ExhibitorTransactionScope.of(EXHIBITOR_ID);

async function seedTicket(unitOfWork: FakeSampleUnitOfWork): Promise<void> {
    await new CreateItemHandler(unitOfWork).execute(
        { id: '00000000-0000-4000-8000-000000000031', name: 'The Item' },
        ClubTransactionScope.of(CLUB_ID, CLUB_PRINCIPAL_ID),
    );
    await new CreateTicketHandler(unitOfWork).execute(
        {
            id: '00000000-0000-4000-8000-000000000021',
            itemId: '00000000-0000-4000-8000-000000000031',
            name: 'Old name',
        },
        EXHIBITOR_SCOPE,
    );
}

describe('RenameTicketHandler', () => {
    it('renames an existing Ticket', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await seedTicket(unitOfWork);

        const response = await new RenameTicketHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
            EXHIBITOR_SCOPE,
        );

        expect(response).toEqual({ id: '00000000-0000-4000-8000-000000000021', name: 'New name' });
        expect(unitOfWork.recordedEvents.at(-1)?.type).toBe('sample.TicketRenamed');
    });

    it('throws TicketNotFoundError for an unknown id', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();

        await expect(
            new RenameTicketHandler(unitOfWork).execute(
                { id: '00000000-0000-4000-8000-000000000099', name: 'New name' },
                EXHIBITOR_SCOPE,
            ),
        ).rejects.toThrow(TicketNotFoundError);
    });
});
