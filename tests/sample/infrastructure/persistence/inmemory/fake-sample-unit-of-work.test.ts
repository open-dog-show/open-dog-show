// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, asPrincipalId, ClubTransactionScope } from '../../../../../src/Shared/index.js';
import { asItemId } from '../../../../../src/sample/domain/shared/domain-ids.js';
import { Item } from '../../../../../src/sample/domain/model/item/item.js';
import { UnitOfWorkClosedError } from '../../../../../src/sample/domain/shared/unit-of-work-closed-error.js';
import { FakeSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import type { SampleUnitOfWorkContext } from '../../../../../src/sample/application/ports/unit-of-work.js';

const CLUB_ID = asClubId('club-a');
const CREATED_BY = asPrincipalId('principal-a');
const SCOPE = ClubTransactionScope.of(CLUB_ID, CREATED_BY);

/**
 * Pins #188's "context is closed after `run` and throws on later use"
 * contract for {@link FakeSampleUnitOfWork} (#209, mechanical batch item 3):
 * a `ctx` that escapes `run`'s callback must throw {@link UnitOfWorkClosedError}
 * on every repository-port method, not silently keep working against state
 * from an attempt that already finished.
 */
describe('FakeSampleUnitOfWork — closed after run() (#188)', () => {
    it('throws UnitOfWorkClosedError naming the aggregate and operation when findById is called after run() resolves', async () => {
        const uow = new FakeSampleUnitOfWork();
        let escapedCtx: SampleUnitOfWorkContext | undefined;

        await uow.run(SCOPE, (ctx) => {
            escapedCtx = ctx;
            return Promise.resolve();
        });

        const itemId = asItemId('item-1');
        const findById = escapedCtx?.items.findById(itemId);
        await expect(findById).rejects.toThrow(UnitOfWorkClosedError);
        await expect(findById).rejects.toMatchObject({ aggregate: 'Item', operation: 'findById' });
    });

    it('throws UnitOfWorkClosedError when add is called after run() resolves', async () => {
        const uow = new FakeSampleUnitOfWork();
        let escapedCtx: SampleUnitOfWorkContext | undefined;

        await uow.run(SCOPE, (ctx) => {
            escapedCtx = ctx;
            return Promise.resolve();
        });

        const item = Item.create({
            id: asItemId('item-2'),
            clubId: CLUB_ID,
            createdBy: CREATED_BY,
            name: 'Late Item',
        });
        await expect(escapedCtx?.items.add(item)).rejects.toThrow(UnitOfWorkClosedError);
    });

    it('does not throw for ports used inside run(), only after it resolves', async () => {
        const uow = new FakeSampleUnitOfWork();

        await expect(
            uow.run(SCOPE, async (ctx) => {
                const item = Item.create({
                    id: asItemId('item-3'),
                    clubId: CLUB_ID,
                    createdBy: CREATED_BY,
                    name: 'In-Transaction Item',
                });
                await ctx.items.add(item);
                const found = await ctx.items.findById(item.id);
                expect(found?.name).toBe('In-Transaction Item');
            }),
        ).resolves.toBeUndefined();
    });
});
