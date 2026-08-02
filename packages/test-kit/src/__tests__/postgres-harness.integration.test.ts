// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresHarness } from '../postgres-harness.js';
import { runMigrations } from '../migration-runner.js';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixtureContext = {
    name: 'sample_context',
    migrationsDir: resolve(__dirname, 'fixtures/sample-context/migrations'),
};

describe('Postgres harness + migration runner', () => {
    const harness = new PostgresHarness();

    beforeAll(async () => {
        await harness.start();
        await runMigrations(harness.connectionUrl, [fixtureContext]);
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    it('exposes a postgresql connection URL after start', () => {
        expect(harness.connectionUrl).toMatch(/^postgresql:\/\//);
    });

    it('creates the context schema', async () => {
        const client = new Client({ connectionString: harness.connectionUrl });
        await client.connect();
        try {
            const result = await client.query<{ schema_name: string }>(
                `SELECT schema_name
         FROM information_schema.schemata
         WHERE schema_name = $1`,
                [fixtureContext.name],
            );
            expect(result.rows).toHaveLength(1);
        } finally {
            await client.end();
        }
    });

    it('applies the fixture migration so the table exists', async () => {
        const client = new Client({ connectionString: harness.connectionUrl });
        await client.connect();
        try {
            const result = await client.query<{ table_name: string }>(
                `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_name   = 'dogs'`,
                [fixtureContext.name],
            );
            expect(result.rows).toHaveLength(1);
        } finally {
            await client.end();
        }
    });

    it('records the applied migration in the tracking table', async () => {
        const client = new Client({ connectionString: harness.connectionUrl });
        await client.connect();
        try {
            const result = await client.query<{ filename: string }>(
                `SELECT filename
         FROM sample_context._migrations
         ORDER BY filename`,
            );
            expect(result.rows).toEqual([{ filename: '0001_create_dogs_table.sql' }]);
        } finally {
            await client.end();
        }
    });
});
