// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { asClubId } from '../../../../Shared/index.js';
import { asShowId } from '../../../domain/shared/domain-ids.js';
import { showsTable } from './schema.js';
import type { Show } from '../../../domain/model/show/show.js';
import type { ShowRepository } from '../../../domain/model/show/show-repository.js';

export class DrizzleShowRepository implements ShowRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findAll(): Promise<ReadonlyArray<Show>> {
        const rows = await this.drizzle.select().from(showsTable);
        return rows.map((row) => ({
            id: asShowId(row.id),
            clubId: asClubId(row.clubId),
            name: row.name,
        }));
    }

    async save(show: Show): Promise<void> {
        await this.drizzle
            .insert(showsTable)
            .values({ id: show.id, clubId: show.clubId, name: show.name })
            .onConflictDoUpdate({ target: showsTable.id, set: { name: show.name } });
    }
}
