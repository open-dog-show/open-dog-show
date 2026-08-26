// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent, TransactionScope } from '@ods/kernel';
import type { EntryRepository } from './entry.js';
import type { ShowRepository } from './show.js';

/**
 * The repositories and event sink available inside one sample-context
 * unit of work (ADR-0014).
 *
 * The application layer names only these members — never `pg`, `pg.PoolClient`,
 * `OutboxWriter`, or `withOutboxTransaction`. The {@link SampleUnitOfWork}
 * implementation owns the transaction boundary and constructs the Drizzle
 * repositories inside it.
 */
export interface SampleUnitOfWorkContext {
    /** The Entry repository, transaction-bound by the surrounding unit of work. */
    readonly entries: EntryRepository;
    /** The Show repository, transaction-bound by the surrounding unit of work. */
    readonly shows: ShowRepository;
    /**
     * Queues domain events for atomic outbox-write at the end of the unit of
     * work. Read-only operations simply do not call this.
     */
    appendEvents(...events: DomainEvent<unknown>[]): void;
}

/**
 * Per-context unit-of-work port (ADR-0014).
 *
 * Opens a transaction scoped to `scope` (setting the RLS session variables),
 * constructs the context's repositories inside it, runs `body`, then commits
 * — atomically writing any appended domain events to the outbox before
 * commit (or rolling back on error).
 */
export interface SampleUnitOfWork {
    run<T>(scope: TransactionScope, body: (ctx: SampleUnitOfWorkContext) => Promise<T>): Promise<T>;
}
