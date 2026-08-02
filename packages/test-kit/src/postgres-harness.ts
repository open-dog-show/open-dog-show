// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Manages a throwaway PostgreSQL container for integration tests.
 *
 * Usage:
 *   const harness = new PostgresHarness();
 *   await harness.start();          // in beforeAll
 *   harness.connectionUrl           // postgres superuser URL
 *   await harness.stop();           // in afterAll
 */
export class PostgresHarness {
    private container: StartedPostgreSqlContainer | undefined;

    get connectionUrl(): string {
        if (this.container === undefined) {
            throw new Error('PostgresHarness: call start() before accessing connectionUrl');
        }
        return this.container.getConnectionUri();
    }

    async start(): Promise<void> {
        this.container = await new PostgreSqlContainer().start();
    }

    async stop(): Promise<void> {
        await this.container?.stop();
        this.container = undefined;
    }
}
