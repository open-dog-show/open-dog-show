// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresHarness, runMigrations } from '@ods/test-kit';
import { withTransaction, asClubId, asPrincipalId } from '@ods/kernel';
import { DrizzleShowRepository } from '../infrastructure/drizzle-show-repository.js';
import { DrizzleEntryRepository } from '../infrastructure/drizzle-entry-repository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fixed IDs for deterministic test data.
const CLUB_A_ID = '00000000-0000-4000-8000-000000000001';
const CLUB_B_ID = '00000000-0000-4000-8000-000000000002';
const ACCOUNT_A_ID = '00000000-0000-4000-8000-000000000011';
const ACCOUNT_B_ID = '00000000-0000-4000-8000-000000000012';
const SHOW_A_ID = '00000000-0000-4000-8000-000000000021';
const SHOW_B_ID = '00000000-0000-4000-8000-000000000022';
const ENTRY_HYBRID_ID = '00000000-0000-4000-8000-000000000031';

describe('RLS isolation — sample context', () => {
    const harness = new PostgresHarness();
    let appPool: pg.Pool;

    beforeAll(async () => {
        await harness.start();

        await runMigrations(harness.connectionUrl, [
            {
                name: 'sample',
                migrationsDir: resolve(__dirname, '../infrastructure/migrations'),
            },
        ]);

        // Build the app_user connection URL by swapping credentials.
        const appUserUrl = harness.connectionUrl.replace(
            /\/\/[^:]+:[^@]+@/,
            '//app_user:app_user@',
        );
        appPool = new pg.Pool({ connectionString: appUserUrl });

        // Seed test data as superuser (bypasses RLS entirely).
        const superClient = new pg.Client({ connectionString: harness.connectionUrl });
        await superClient.connect();
        try {
            await superClient.query(
                `INSERT INTO sample.shows (id, club_id, name) VALUES
                   ($1, $2, 'Club A Show'),
                   ($3, $4, 'Club B Show')`,
                [SHOW_A_ID, CLUB_A_ID, SHOW_B_ID, CLUB_B_ID],
            );
            // Hybrid entry: owned by Club A, submitted by User A.
            await superClient.query(
                `INSERT INTO sample.entries (id, club_id, user_id, show_id, dog_name) VALUES
                   ($1, $2, $3, $4, 'Fido')`,
                [ENTRY_HYBRID_ID, CLUB_A_ID, ACCOUNT_A_ID, SHOW_A_ID],
            );
        } finally {
            await superClient.end();
        }
    }, 120_000);

    afterAll(async () => {
        await appPool?.end();
        await harness.stop();
    });

    describe('Club-scoped table isolation (shows)', () => {
        it('club-A scope sees only Club A shows', async () => {
            await withTransaction(
                appPool,
                {
                    kind: 'club',
                    clubId: asClubId(CLUB_A_ID),
                    principalId: asPrincipalId(ACCOUNT_A_ID),
                },
                async (client) => {
                    const repo = new DrizzleShowRepository(client);
                    const shows = await repo.findAll();
                    expect(shows).toHaveLength(1);
                    expect(shows[0]?.name).toBe('Club A Show');
                },
            );
        });

        it('club-B scope sees only Club B shows, not Club A', async () => {
            await withTransaction(
                appPool,
                {
                    kind: 'club',
                    clubId: asClubId(CLUB_B_ID),
                    principalId: asPrincipalId(ACCOUNT_B_ID),
                },
                async (client) => {
                    const repo = new DrizzleShowRepository(client);
                    const shows = await repo.findAll();
                    expect(shows).toHaveLength(1);
                    expect(shows[0]?.name).toBe('Club B Show');
                },
            );
        });
    });

    describe('hybrid table isolation (entries)', () => {
        it('club-A scope sees the hybrid entry (matched by club_id)', async () => {
            await withTransaction(
                appPool,
                {
                    kind: 'club',
                    clubId: asClubId(CLUB_A_ID),
                    principalId: asPrincipalId(ACCOUNT_A_ID),
                },
                async (client) => {
                    const repo = new DrizzleEntryRepository(client);
                    const entries = await repo.findAll();
                    expect(entries).toHaveLength(1);
                    expect(entries[0]?.dogName).toBe('Fido');
                },
            );
        });

        it('exhibitor-A scope sees the hybrid entry (matched by user_id)', async () => {
            await withTransaction(
                appPool,
                { kind: 'exhibitor', principalId: asPrincipalId(ACCOUNT_A_ID) },
                async (client) => {
                    const repo = new DrizzleEntryRepository(client);
                    const entries = await repo.findAll();
                    expect(entries).toHaveLength(1);
                    expect(entries[0]?.dogName).toBe('Fido');
                },
            );
        });

        it('club-B scope cannot see the hybrid entry belonging to club-A', async () => {
            await withTransaction(
                appPool,
                {
                    kind: 'club',
                    clubId: asClubId(CLUB_B_ID),
                    principalId: asPrincipalId(ACCOUNT_B_ID),
                },
                async (client) => {
                    const repo = new DrizzleEntryRepository(client);
                    const entries = await repo.findAll();
                    expect(entries).toHaveLength(0);
                },
            );
        });
    });
});
