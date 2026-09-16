// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { asClubId } from '../../../../Shared/index.js';
import { asShowId, type ShowId } from '../../../domain/shared/domain-ids.js';
import { showsTable } from './schema.js';
import { Show } from '../../../domain/model/show/show.js';
import type { ShowRepository } from '../../../domain/model/show/show-repository.js';
import { ShowPersistenceFailed } from './persistence-errors.js';

export class DrizzleShowRepository implements ShowRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findAll(): Promise<ReadonlyArray<Show>> {
        try {
            const rows = await this.drizzle.select().from(showsTable);
            return rows.map((row) =>
                Show.rehydrate(asShowId(row.id), asClubId(row.clubId), row.name),
            );
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new ShowPersistenceFailed('reading shows', cause);
        }
    }

    async findById(id: ShowId): Promise<Show | undefined> {
        try {
            const [row] = await this.drizzle.select().from(showsTable).where(eq(showsTable.id, id));
            return row === undefined
                ? undefined
                : Show.rehydrate(asShowId(row.id), asClubId(row.clubId), row.name);
        } catch (cause) {
            throw new ShowPersistenceFailed('reading a show', cause);
        }
    }

    async save(show: Show): Promise<void> {
        try {
            await this.drizzle
                .insert(showsTable)
                .values({ id: show.id, clubId: show.clubId, name: show.name })
                .onConflictDoUpdate({ target: showsTable.id, set: { name: show.name } });
        } catch (cause) {
            throw new ShowPersistenceFailed('saving a show', cause);
        }
    }
}
