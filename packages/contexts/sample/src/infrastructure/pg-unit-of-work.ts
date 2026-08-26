// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import { withOutboxTransaction, type OutboxWriter, type TransactionScope } from '@ods/kernel';
import { DrizzleEntryRepository } from './drizzle-entry-repository.js';
import { DrizzleShowRepository } from './drizzle-show-repository.js';
import type { SampleUnitOfWork, SampleUnitOfWorkContext } from '../domain/unit-of-work.js';

/**
 * PostgreSQL implementation of the sample-context {@link SampleUnitOfWork} port
 * (ADR-0014).
 *
 * Wraps the kernel's `withOutboxTransaction`: it opens the transaction, sets the
 * RLS session variables from `scope`, constructs the Drizzle repositories inside
 * the transaction, runs `body` against a {@link SampleUnitOfWorkContext}, then
 * atomically writes any appended domain events to the outbox before commit (or
 * rolls back on error).
 *
 * Constructed once at the composition root with a `pg.Pool` and an
 * `OutboxWriter`; injected into use-case classes. The application layer never
 * sees `pg`, `pg.PoolClient`, or `withOutboxTransaction`.
 */
export class PgSampleUnitOfWork implements SampleUnitOfWork {
    /**
     * @param pool - The PostgreSQL connection pool (app role, RLS-enforced).
     * @param writer - The schema-scoped outbox writer for this context.
     */
    constructor(
        private readonly pool: pg.Pool,
        private readonly writer: OutboxWriter,
    ) {}

    async run<T>(
        scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        return withOutboxTransaction(this.pool, scope, this.writer, async (client, outbox) => {
            const ctx: SampleUnitOfWorkContext = {
                entries: new DrizzleEntryRepository(client),
                shows: new DrizzleShowRepository(client),
                appendEvents: (...events) => outbox.append(...events),
            };
            return body(ctx);
        });
    }
}
