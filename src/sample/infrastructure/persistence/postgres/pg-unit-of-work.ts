// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    withOutboxTransaction,
    type CrudRepositoryPort,
    type DomainEventFact,
    type OutboxTransactionDeps,
    type TransactionScope,
} from '../../../../Shared/index.js';
// plop:imports
import { DrizzleAnnouncementRepository } from './drizzle-announcement-repository.js';

import { DrizzleTicketRepository } from './drizzle-ticket-repository.js';

import { DrizzleNoteRepository } from './drizzle-note-repository.js';

import { DrizzleItemRepository } from './drizzle-item-repository.js';

import type {
    SampleUnitOfWork,
    SampleUnitOfWorkContext,
} from '../../../application/ports/unit-of-work.js';
import { UnitOfWorkClosedError } from '../../../domain/shared/unit-of-work-closed-error.js';

/**
 * Wraps a repository's `add`/`update` so each pulls and forwards the
 * aggregate's recorded facts to `record` (ADR-0027) — the single place this
 * context translates "saved" into "events queued for the outbox", shared by
 * every aggregate's port instead of repeated per aggregate. Every method
 * first checks `closed` so a `ctx` that escaped its `run` callback (#188)
 * throws {@link UnitOfWorkClosedError} instead of touching a
 * connection/transaction that no longer belongs to it.
 */
function wrapRepositoryPort<Id, T extends { pullEvents(): readonly DomainEventFact[] }>(
    repository: CrudRepositoryPort<Id, T>,
    options: {
        readonly record: (...facts: readonly DomainEventFact[]) => void;
        readonly closed: { readonly value: boolean };
        readonly typeName: string;
    },
): CrudRepositoryPort<Id, T> {
    const assertOpen = (operation: string): void => {
        if (options.closed.value) throw new UnitOfWorkClosedError(options.typeName, operation);
    };
    return {
        findById: async (id) => {
            assertOpen('findById');
            return repository.findById(id);
        },
        add: async (entity) => {
            assertOpen('add');
            await repository.add(entity);
            options.record(...entity.pullEvents());
        },
        update: async (entity) => {
            assertOpen('update');
            await repository.update(entity);
            options.record(...entity.pullEvents());
        },
    };
}

/**
 * PostgreSQL implementation of the sample-context
 * {@link SampleUnitOfWork} port (ADR-0014).
 *
 * Wraps the kernel's `withOutboxTransaction`: it opens the transaction, sets
 * the RLS session variables from `scope`, constructs the Drizzle repositories
 * inside the transaction, runs `body` against a
 * {@link SampleUnitOfWorkContext}, then atomically writes any
 * recorded domain facts to the outbox before commit (or rolls back on error).
 * Saving an aggregate through its repository's `add`/`update` pulls and
 * stamps its recorded events (ADR-0027) — the application layer never touches
 * events, `pg`, `pg.PoolClient`, or `withOutboxTransaction`. Once `run`
 * resolves, `ctx` is closed (#188) — a caller that let it escape gets
 * {@link UnitOfWorkClosedError} on any further use.
 *
 * Constructed once at the composition root with a `pg.Pool`, a
 * `PgOutboxWriter`, and the `Clock` / `EventIdGenerator` ports used to stamp
 * event envelopes; injected into use-case classes.
 */
export class PgSampleUnitOfWork implements SampleUnitOfWork {
    private readonly deps: OutboxTransactionDeps;

    /**
     * @param deps.pool - The PostgreSQL connection pool (app role, RLS-enforced).
     * @param deps.writer - The schema-scoped outbox writer for this context.
     * @param deps.clock - Stamps `occurredAt` on events pulled from a saved aggregate.
     * @param deps.eventIdGenerator - Stamps `eventId` on events pulled from a saved aggregate.
     */
    constructor(deps: OutboxTransactionDeps) {
        this.deps = deps;
    }

    async run<T>(
        scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        const closed = { value: false };
        try {
            return await withOutboxTransaction({ ...this.deps, scope }, async (client, record) => {
                // plop:repository-instances
                const announcementRepository = new DrizzleAnnouncementRepository(client);

                const ticketRepository = new DrizzleTicketRepository(client);

                const noteRepository = new DrizzleNoteRepository(client);

                const itemRepository = new DrizzleItemRepository(client);

                const portDeps = { record, closed };
                const ctx: SampleUnitOfWorkContext = {
                    // plop:repositories
                    announcements: wrapRepositoryPort(announcementRepository, {
                        ...portDeps,
                        typeName: 'Announcement',
                    }),

                    tickets: wrapRepositoryPort(ticketRepository, {
                        ...portDeps,
                        typeName: 'Ticket',
                    }),

                    notes: wrapRepositoryPort(noteRepository, { ...portDeps, typeName: 'Note' }),

                    items: wrapRepositoryPort(itemRepository, { ...portDeps, typeName: 'Item' }),
                };
                return body(ctx);
            });
        } finally {
            closed.value = true;
        }
    }
}
