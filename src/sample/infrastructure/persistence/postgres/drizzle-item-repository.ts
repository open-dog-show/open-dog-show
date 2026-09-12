// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { asClubId, asPrincipalId } from '../../../../Shared/index.js';
import { asItemId, type ItemId } from '../../../domain/shared/domain-ids.js';
import { itemsTable } from './schema.js';
import { Item } from '../../../domain/model/item/item.js';
import type { ItemRepository } from '../../../domain/model/item/item-repository.js';
import { ItemPersistenceFailed } from './item-persistence-failed.js';

export class DrizzleItemRepository implements ItemRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findById(id: ItemId): Promise<Item | undefined> {
        try {
            const [row] = await this.drizzle.select().from(itemsTable).where(eq(itemsTable.id, id));
            return row === undefined
                ? undefined
                : Item.rehydrate({
                      id: asItemId(row.id),
                      clubId: asClubId(row.clubId),
                      createdBy: asPrincipalId(row.principalId),
                      name: row.name,
                  });
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new ItemPersistenceFailed('reading a item', cause);
        }
    }

    async add(item: Item): Promise<void> {
        try {
            await this.drizzle.insert(itemsTable).values({
                id: item.id,
                clubId: item.clubId,
                principalId: item.createdBy,
                name: item.name,
            });
        } catch (cause) {
            throw new ItemPersistenceFailed('adding a item', cause);
        }
    }

    async update(item: Item): Promise<void> {
        try {
            await this.drizzle
                .update(itemsTable)
                .set({ name: item.name })
                .where(eq(itemsTable.id, item.id));
        } catch (cause) {
            throw new ItemPersistenceFailed('updating a item', cause);
        }
    }
}
