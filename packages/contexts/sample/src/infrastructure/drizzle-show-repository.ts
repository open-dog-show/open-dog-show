// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { asClubId } from '@ods/kernel';
import { showsTable } from './schema.js';
import type { Show, ShowRepository } from '../domain/show.js';

export class DrizzleShowRepository implements ShowRepository {
    private readonly db;

    constructor(client: pg.PoolClient) {
        this.db = drizzle(client);
    }

    async findAll(): Promise<Show[]> {
        const rows = await this.db.select().from(showsTable);
        return rows.map((row) => ({
            id: row.id,
            clubId: asClubId(row.clubId),
            name: row.name,
        }));
    }

    async save(show: Show): Promise<void> {
        await this.db
            .insert(showsTable)
            .values({ id: show.id, clubId: show.clubId, name: show.name })
            .onConflictDoUpdate({ target: showsTable.id, set: { name: show.name } });
    }
}
