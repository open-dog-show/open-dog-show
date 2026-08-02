// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Client } = pg;

/** Describes one bounded-context's migration folder. */
export interface MigrationContext {
    /** The context's schema name (e.g. `'entries'`). */
    name: string;
    /** Absolute path to the directory containing numbered `.sql` files. */
    migrationsDir: string;
}

/**
 * Applies per-context SQL migrations to the given database.
 *
 * For each context the runner:
 *   1. Creates the `migration_owner` role (if absent) and grants it to the
 *      current superuser so `SET ROLE` works.
 *   2. Creates the context's schema as `migration_owner`.
 *   3. Creates a `_migrations` tracking table inside that schema.
 *   4. Reads all `.sql` files from `migrationsDir` in lexicographic order and
 *      applies every file that has not been recorded in `_migrations`.
 *
 * The runner connects as the supplied superuser URL and switches to the
 * `migration_owner` role for DDL, matching how production migrations are applied.
 */
export async function runMigrations(
    connectionUrl: string,
    contexts: MigrationContext[],
): Promise<void> {
    const client = new Client({ connectionString: connectionUrl });
    await client.connect();

    try {
        await bootstrapRole(client);

        for (const context of contexts) {
            await applyContext(client, context);
        }
    } finally {
        await client.end();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function bootstrapRole(client: pg.Client): Promise<void> {
    // Create the migration-owner role if it does not exist yet.
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'migration_owner'
      ) THEN
        CREATE ROLE migration_owner WITH LOGIN PASSWORD 'migration_owner';
      END IF;
    END
    $$;
  `);

    // Grant the role to the current user so SET ROLE succeeds.
    await client.query(`GRANT migration_owner TO CURRENT_USER`);
}

async function applyContext(client: pg.Client, context: MigrationContext): Promise<void> {
    const { name, migrationsDir } = context;

    // All DDL for this context runs as migration_owner.
    await client.query(`SET ROLE migration_owner`);

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(name)}`);

    await client.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdent(name)}._migrations (
      filename   TEXT        NOT NULL PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

    const files = await migrationFiles(migrationsDir);

    for (const filename of files) {
        const alreadyApplied = await client.query<{ filename: string }>(
            `SELECT filename FROM ${quoteIdent(name)}._migrations WHERE filename = $1`,
            [filename],
        );

        if (alreadyApplied.rows.length > 0) continue;

        const sql = await readFile(join(migrationsDir, filename), 'utf8');
        await client.query(sql);

        await client.query(`INSERT INTO ${quoteIdent(name)}._migrations (filename) VALUES ($1)`, [
            filename,
        ]);
    }

    await client.query(`RESET ROLE`);
}

/** Returns `.sql` filenames from the directory, sorted lexicographically. */
async function migrationFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.sql')).sort();
}

/**
 * Double-quotes a PostgreSQL identifier and escapes embedded double-quotes.
 * This guards against schema names that contain special characters.
 */
function quoteIdent(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
}
