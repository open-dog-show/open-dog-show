// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresHarness } from '../postgres-harness.js';
import { runMigrations } from '../migration-runner.js';

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
        const { rows } = await harness.superPool.query<{ schema_name: string }>(
            `SELECT schema_name
         FROM information_schema.schemata
         WHERE schema_name = $1`,
            [fixtureContext.name],
        );
        expect(rows).toHaveLength(1);
    });

    it('applies the fixture migration so the table exists', async () => {
        const { rows } = await harness.superPool.query<{ table_name: string }>(
            `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_name   = 'dogs'`,
            [fixtureContext.name],
        );
        expect(rows).toHaveLength(1);
    });

    it('records the applied migrations in the tracking table', async () => {
        const { rows } = await harness.superPool.query<{ filename: string }>(
            `SELECT filename
         FROM sample_context._migrations
         ORDER BY filename`,
        );
        expect(rows).toEqual([
            { filename: '0001_create_dogs_table.sql' },
            { filename: '0002_create_secrets_table.sql' },
        ]);
    });

    // -------------------------------------------------------------------------
    // Deepened harness surface: superPool / appUserPool / seed()
    // -------------------------------------------------------------------------

    it('superPool and appUserPool are lazily created, cached, and distinct', () => {
        expect(harness.superPool).toBe(harness.superPool);
        expect(harness.appUserPool).toBe(harness.appUserPool);
        expect(harness.superPool).not.toBe(harness.appUserPool);
    });

    it('appUserPool connects as the RLS-enforced app_user role while superPool bypasses RLS', async () => {
        const superId = '00000000-0000-4000-8000-0000000000a1';
        const appId = '00000000-0000-4000-8000-0000000000a2';

        // superuser bypasses RLS — the insert succeeds.
        await harness.superPool.query(
            `INSERT INTO sample_context.secrets (id, name) VALUES ($1, $2)`,
            [superId, 'super-secret'],
        );

        // app_user is RLS-enforced — the WITH CHECK (false) policy blocks the
        // insert with a row-level-security violation.
        await expect(
            harness.appUserPool.query(
                `INSERT INTO sample_context.secrets (id, name) VALUES ($1, $2)`,
                [appId, 'blocked'],
            ),
        ).rejects.toThrow(/row-level security policy/);

        // The blocked app_user row never landed; the superuser row did.
        const { rows } = await harness.superPool.query<{ id: string }>(
            `SELECT id FROM sample_context.secrets ORDER BY id`,
        );
        expect(rows.map((r) => r.id)).toEqual([superId]);
    });

    it('seed() runs the callback on a superuser client checked out from superPool', async () => {
        const { rows: direct } = await harness.superPool.query<{ current_user: string }>(
            `SELECT current_user`,
        );
        const superuser = direct[0]?.current_user;

        await harness.seed(async (client) => {
            const { rows } = await client.query<{ current_user: string }>(`SELECT current_user`);
            expect(rows[0]?.current_user).toBe(superuser);
            expect(rows[0]?.current_user).not.toBe('app_user');
        });
    });

    it('seed() returns the client to the pool even when the callback throws', async () => {
        await expect(
            harness.seed(async () => {
                throw new Error('boom');
            }),
        ).rejects.toThrow('boom');

        // No leaked client: the pool is fully idle after the failed seed.
        expect(harness.superPool.idleCount).toBe(harness.superPool.totalCount);

        // And the pool still serves queries.
        const { rows } = await harness.superPool.query<{ ok: number }>(`SELECT 1 AS ok`);
        expect(rows[0]?.ok).toBe(1);
    });
});
