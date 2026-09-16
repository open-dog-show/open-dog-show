// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../../../Shared/index.js';
import type { EntryRepository } from '../../domain/model/entry/entry-repository.js';
import type { ShowRepository } from '../../domain/model/show/show-repository.js';

/**
 * The repositories available inside one sample-context unit of work
 * (ADR-0014).
 *
 * The application layer names only these members — never `pg`,
 * `pg.PoolClient`, `PgOutboxWriter`, or `withOutboxTransaction`, and never
 * touches domain events (ADR-0027): saving an `Entry` through
 * {@link SampleUnitOfWorkContext.entries} pulls and records its events
 * internally. The {@link SampleUnitOfWork} implementation owns the
 * transaction boundary and constructs the Drizzle repositories inside it.
 */
export interface SampleUnitOfWorkContext {
    /** The Entry repository, transaction-bound by the surrounding unit of work. */
    readonly entries: EntryRepository;
    /** The Show repository, transaction-bound by the surrounding unit of work. */
    readonly shows: ShowRepository;
}

/**
 * Per-context unit-of-work port (ADR-0014).
 *
 * Opens a transaction scoped to `scope` (setting the RLS session variables),
 * constructs the context's repositories inside it, runs `body`, then commits
 * — atomically writing any events recorded by a saved aggregate to the
 * outbox before commit (or rolling back on error).
 */
export interface SampleUnitOfWork {
    run<T>(scope: TransactionScope, body: (ctx: SampleUnitOfWorkContext) => Promise<T>): Promise<T>;
}
