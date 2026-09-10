// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import pg from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const { Pool } = pg;

/**
 * Manages a throwaway PostgreSQL container for integration tests.
 *
 * The harness is the single seam for both connection surfaces and superuser
 * seeding:
 *   - `connectionUrl` / `superPool` — the superuser connection (bypasses RLS).
 *   - `appUserPool` — the RLS-enforced `app_user` connection the application
 *     uses at runtime. The `app_user` role is created by `runMigrations`.
 *   - `seed(fn)` — runs `fn` on a superuser client checked out from
 *     `superPool` (so fixtures are writable regardless of tenant scope) and
 *     returns the client to the pool even when `fn` throws.
 *
 * Usage:
 *   const harness = new PostgresHarness();
 *   await harness.start();            // in beforeAll
 *   await runMigrations(harness.connectionUrl, [...]); // creates the app_user role
 *   harness.superPool                 // superuser pg.Pool (cached)
 *   harness.appUserPool               // RLS-enforced pg.Pool (cached)
 *   await harness.seed(async (c) => {...}); // superuser fixture write
 *   await harness.stop();             // in afterAll — ends both pools + container
 */
export class PostgresHarness {
    private container: StartedPostgreSqlContainer | undefined;
    private superPoolCache: pg.Pool | undefined;
    private appUserPoolCache: pg.Pool | undefined;

    get connectionUrl(): string {
        if (this.container === undefined) {
            throw new Error('PostgresHarness: call start() before accessing connectionUrl');
        }
        return this.container.getConnectionUri().replace(/^postgres:\/\//, 'postgresql://');
    }

    /**
     * A lazily created, cached superuser `pg.Pool` (bypasses RLS). Use for
     * superuser assertions and fixture writes (via `seed()`).
     */
    get superPool(): pg.Pool {
        if (this.superPoolCache === undefined) {
            this.superPoolCache = new Pool({ connectionString: this.connectionUrl });
        }
        return this.superPoolCache;
    }

    /**
     * A lazily created, cached `app_user` `pg.Pool` (RLS-enforced). The role
     * is created by `runMigrations`; `pg.Pool` does not connect until the
     * first query, so accessing this before migrations have run is safe.
     */
    get appUserPool(): pg.Pool {
        if (this.appUserPoolCache === undefined) {
            this.appUserPoolCache = new Pool({
                connectionString: this.appUserConnectionUrl(),
            });
        }
        return this.appUserPoolCache;
    }

    /**
     * Runs `fn` on a superuser `pg.Client` checked out from `superPool` (so
     * fixtures are writable regardless of tenant scope), then returns the
     * client to the pool — even when `fn` throws, so no client is leaked.
     */
    async seed(fn: (client: pg.Client) => Promise<void>): Promise<void> {
        const client = await this.superPool.connect();
        try {
            await fn(client);
        } finally {
            client.release();
        }
    }

    async start(): Promise<void> {
        this.container = await new PostgreSqlContainer().start();
    }

    async stop(): Promise<void> {
        // Tear down both pools and the container in parallel, and do not let one
        // rejection abort the others (a failing pool end would otherwise skip
        // container stop and leak the container). Surface the first rejection
        // after every resource has had a chance to clean up.
        const results = await Promise.allSettled([
            this.superPoolCache?.end(),
            this.appUserPoolCache?.end(),
            this.container?.stop(),
        ]);
        this.superPoolCache = undefined;
        this.appUserPoolCache = undefined;
        this.container = undefined;
        const firstRejection = results.find(
            (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        if (firstRejection !== undefined) {
            const reason = firstRejection.reason;
            // `PromiseRejectedResult.reason` is `any`; rethrowing it unstructured
            // loses the `Error` shape an outer handler assumes — normalise a
            // non-Error rejection into one so the boundary always sees an Error.
            throw reason instanceof Error ? reason : new Error(String(reason));
        }
    }

    /**
     * Derives the RLS-enforced `app_user` connection URL by swapping the
     * superuser credentials in {@link connectionUrl}. The `app_user` role is
     * created by `runMigrations`; this only rewrites the connection string.
     */
    private appUserConnectionUrl(): string {
        return this.connectionUrl.replace(/\/\/[^:]+:[^@]+@/, '//app_user:app_user@');
    }
}
