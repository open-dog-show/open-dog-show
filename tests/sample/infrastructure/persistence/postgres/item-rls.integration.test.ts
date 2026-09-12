// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    PgOutboxWriter,
} from '../../../../../src/Shared/index.js';
import { SystemClock } from '../../../../../src/Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../../src/Shared/infrastructure/random-event-id-generator.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';
import { Item } from '../../../../../src/sample/domain/model/item/item.js';
import { asItemId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const CLUB_A_ID = asClubId('00000000-0000-4000-8000-000000000001');
const CLUB_B_ID = asClubId('00000000-0000-4000-8000-000000000002');
const PRINCIPAL_A_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const PRINCIPAL_B_ID = asPrincipalId('00000000-0000-4000-8000-000000000012');
const ITEM_ID = asItemId('00000000-0000-4000-8000-000000000021');

/** Proves the ADR-0005 `club` RLS policy: visible only to the owning Club. */
describe('Item RLS isolation (club scope)', () => {
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

        await unitOfWork.run(ClubTransactionScope.of(CLUB_A_ID, PRINCIPAL_A_ID), async (ctx) => {
            await ctx.items.add(
                Item.create({
                    id: ITEM_ID,
                    clubId: CLUB_A_ID,
                    createdBy: PRINCIPAL_A_ID,
                    name: 'Club An Item',
                }),
            );
        });
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    it('club A can find its own Item', async () => {
        await unitOfWork.run(ClubTransactionScope.of(CLUB_A_ID, PRINCIPAL_A_ID), async (ctx) => {
            const found = await ctx.items.findById(ITEM_ID);
            expect(found?.name).toBe('Club An Item');
        });
    });

    it("club B cannot find club A's Item", async () => {
        await unitOfWork.run(ClubTransactionScope.of(CLUB_B_ID, PRINCIPAL_B_ID), async (ctx) => {
            const found = await ctx.items.findById(ITEM_ID);
            expect(found).toBeUndefined();
        });
    });
});
