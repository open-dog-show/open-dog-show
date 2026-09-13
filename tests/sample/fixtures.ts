// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PostgresHarness } from '../test-kit/index.js';
import { runMigrations } from '../test-kit/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the sample context's Drizzle migration
 * directory. Shared by the sample integration tests so the
 * migration directory is resolved once.
 */
export const SAMPLE_MIGRATIONS_DIR = resolve(
    __dirname,
    '../../src/sample/infrastructure/persistence/postgres/migrations',
);

/**
 * Starts `harness` and applies the sample context's migrations,
 * leaving the harness ready for use. Shared by the sample
 * integration tests so the migration bootstrap is not duplicated in each
 * `beforeAll`.
 */
export async function bootstrapSampleSchema(harness: PostgresHarness): Promise<void> {
    await harness.start();
    await runMigrations(harness.connectionUrl, [
        {
            name: 'sample',
            migrationsDir: SAMPLE_MIGRATIONS_DIR,
        },
    ]);
}
