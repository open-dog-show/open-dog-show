// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PgOutboxWriter,
} from '../../../../../src/Shared/index.js';
import { SystemClock } from '../../../../../src/Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../../src/Shared/infrastructure/random-event-id-generator.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';
import { Item } from '../../../../../src/sample/domain/model/item/item.js';
import { Ticket } from '../../../../../src/sample/domain/model/ticket/ticket.js';
import { asTicketId, asItemId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const CLUB_A_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_B_ID = asClubId('00000000-0000-4000-8000-000000000002');
const CLUB_A_PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const CLUB_B_PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000012');
const EXHIBITOR_A_ID = asPrincipalId('00000000-0000-4000-8000-000000000021');
const EXHIBITOR_B_ID = asPrincipalId('00000000-0000-4000-8000-000000000022');
const ITEM_ID = asItemId('00000000-0000-4000-8000-000000000031');
const TICKET_ID = asTicketId('00000000-0000-4000-8000-000000000041');

/**
 * Proves the ADR-0005 hybrid RLS policy: a Ticket created by an
 * exhibitor acting cross-Club is visible to that exhibitor (matched by
 * `user_id`) and to the owning Club (matched by `club_id`) — and to no one
 * else.
 */
describe('Ticket RLS isolation (hybrid scope)', () => {
    const harness = new PostgresHarness();
    let unitOfWork: PgSampleUnitOfWork;

    beforeAll(async () => {
        await bootstrapSampleSchema(harness);
        unitOfWork = new PgSampleUnitOfWork(
            harness.appUserPool,
            new PgOutboxWriter('sample'),
            new SystemClock(),
            new RandomEventIdGenerator(),
        );

        await unitOfWork.run(
            ClubTransactionScope.of(CLUB_A_ID, CLUB_A_PRINCIPAL_ID),
            async (ctx) => {
                await ctx.items.add(
                    Item.create({
                        id: ITEM_ID,
                        clubId: CLUB_A_ID,
                        createdBy: CLUB_A_PRINCIPAL_ID,
                        name: 'Club An Item',
                    }),
                );
            },
        );

        // Exhibitor A creates the Ticket cross-Club, referencing
        // Club A's Item — the acting scope carries no clubId at all.
        await unitOfWork.run(ExhibitorTransactionScope.of(EXHIBITOR_A_ID), async (ctx) => {
            await ctx.tickets.add(
                Ticket.create({
                    id: TICKET_ID,
                    clubId: CLUB_A_ID,
                    createdBy: EXHIBITOR_A_ID,
                    itemId: ITEM_ID,
                    name: 'Exhibitor A Ticket',
                }),
            );
        });
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    it('the creating exhibitor (matched by user_id) can find it', async () => {
        await unitOfWork.run(ExhibitorTransactionScope.of(EXHIBITOR_A_ID), async (ctx) => {
            const found = await ctx.tickets.findById(TICKET_ID);
            expect(found?.name).toBe('Exhibitor A Ticket');
        });
    });

    it('the owning Club (matched by club_id) can find it', async () => {
        await unitOfWork.run(
            ClubTransactionScope.of(CLUB_A_ID, CLUB_A_PRINCIPAL_ID),
            async (ctx) => {
                const found = await ctx.tickets.findById(TICKET_ID);
                expect(found?.name).toBe('Exhibitor A Ticket');
            },
        );
    });

    it('a different exhibitor cannot find it', async () => {
        await unitOfWork.run(ExhibitorTransactionScope.of(EXHIBITOR_B_ID), async (ctx) => {
            const found = await ctx.tickets.findById(TICKET_ID);
            expect(found).toBeUndefined();
        });
    });

    it('a different Club cannot find it', async () => {
        await unitOfWork.run(
            ClubTransactionScope.of(CLUB_B_ID, CLUB_B_PRINCIPAL_ID),
            async (ctx) => {
                const found = await ctx.tickets.findById(TICKET_ID);
                expect(found).toBeUndefined();
            },
        );
    });
});
