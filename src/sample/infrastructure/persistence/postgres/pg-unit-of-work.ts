// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import {
    withOutboxTransaction,
    type Clock,
    type EventIdGenerator,
    type PgOutboxWriter,
    type TransactionScope,
} from '../../../../Shared/index.js';
import { DrizzleEntryRepository } from './drizzle-entry-repository.js';
import { DrizzleShowRepository } from './drizzle-show-repository.js';
import type {
    SampleUnitOfWork,
    SampleUnitOfWorkContext,
} from '../../../application/ports/unit-of-work.js';

/**
 * PostgreSQL implementation of the sample-context {@link SampleUnitOfWork} port
 * (ADR-0014).
 *
 * Wraps the kernel's `withOutboxTransaction`: it opens the transaction, sets the
 * RLS session variables from `scope`, constructs the Drizzle repositories inside
 * the transaction, runs `body` against a {@link SampleUnitOfWorkContext}, then
 * atomically writes any recorded domain events to the outbox before commit (or
 * rolls back on error). Saving an `Entry` through `ctx.entries.save` pulls and
 * stamps its recorded events (ADR-0027) — the application layer never touches
 * events, `pg`, `pg.PoolClient`, or `withOutboxTransaction`.
 *
 * Constructed once at the composition root with a `pg.Pool`, a
 * `PgOutboxWriter`, and the `Clock` / `EventIdGenerator` ports used to stamp
 * event envelopes; injected into use-case classes.
 */
export class PgSampleUnitOfWork implements SampleUnitOfWork {
    /**
     * @param pool - The PostgreSQL connection pool (app role, RLS-enforced).
     * @param writer - The schema-scoped outbox writer for this context.
     * @param clock - Stamps `occurredAt` on events pulled from a saved aggregate.
     * @param eventIdGenerator - Stamps `eventId` on events pulled from a saved aggregate.
     */
    constructor(
        private readonly pool: pg.Pool,
        private readonly writer: PgOutboxWriter,
        private readonly clock: Clock,
        private readonly eventIdGenerator: EventIdGenerator,
    ) {}

    async run<T>(
        scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        return withOutboxTransaction(
            this.pool,
            scope,
            this.writer,
            this.clock,
            this.eventIdGenerator,
            async (client, record) => {
                const entryRepository = new DrizzleEntryRepository(client);
                const ctx: SampleUnitOfWorkContext = {
                    entries: {
                        findAll: () => entryRepository.findAll(),
                        save: async (entry) => {
                            await entryRepository.save(entry);
                            record(...entry.pullEvents());
                        },
                    },
                    shows: new DrizzleShowRepository(client),
                };
                return body(ctx);
            },
        );
    }
}
