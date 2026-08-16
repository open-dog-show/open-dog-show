// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { asTenantId, asUserId } from '@ods/kernel';
import { entriesTable } from './schema.js';
import type { Entry, EntryRepository } from '../domain/entry.js';

export class DrizzleEntryRepository implements EntryRepository {
    private readonly db;

    constructor(client: pg.PoolClient) {
        this.db = drizzle(client);
    }

    async findAll(): Promise<Entry[]> {
        const rows = await this.db.select().from(entriesTable);
        return rows.map((row) => ({
            id: row.id,
            tenantId: asTenantId(row.tenantId),
            userId: asUserId(row.userId),
            showId: row.showId,
            dogName: row.dogName,
        }));
    }

    async save(entry: Entry): Promise<void> {
        await this.db
            .insert(entriesTable)
            .values({
                id: entry.id,
                tenantId: entry.tenantId,
                userId: entry.userId,
                showId: entry.showId,
                dogName: entry.dogName,
            })
            .onConflictDoUpdate({
                target: entriesTable.id,
                set: { dogName: entry.dogName },
            });
    }
}
