// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { asClubId, asPrincipalId } from '../../../../Shared/index.js';
import { asEntryId, asShowId } from '../../../domain/shared/domain-ids.js';
import { entriesTable } from './schema.js';
import type { Entry } from '../../../domain/model/entry/entry.js';
import type { EntryRepository } from '../../../domain/model/entry/entry-repository.js';
import { EntryPersistenceFailed } from './persistence-errors.js';

export class DrizzleEntryRepository implements EntryRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findAll(): Promise<ReadonlyArray<Entry>> {
        try {
            const rows = await this.drizzle.select().from(entriesTable);
            return rows.map((row) => ({
                id: asEntryId(row.id),
                clubId: asClubId(row.clubId),
                principalId: asPrincipalId(row.principalId),
                showId: asShowId(row.showId),
                dogName: row.dogName,
            }));
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new EntryPersistenceFailed('reading entries', cause);
        }
    }

    async save(entry: Entry): Promise<void> {
        try {
            await this.drizzle
                .insert(entriesTable)
                .values({
                    id: entry.id,
                    clubId: entry.clubId,
                    principalId: entry.principalId,
                    showId: entry.showId,
                    dogName: entry.dogName,
                })
                .onConflictDoUpdate({
                    target: entriesTable.id,
                    set: { dogName: entry.dogName },
                });
        } catch (cause) {
            throw new EntryPersistenceFailed('saving an entry', cause);
        }
    }
}
