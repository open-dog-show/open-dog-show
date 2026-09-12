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
// plop:imports
import { DrizzleAnnouncementRepository } from './drizzle-announcement-repository.js';

import { DrizzleTicketRepository } from './drizzle-ticket-repository.js';

import { DrizzleNoteRepository } from './drizzle-note-repository.js';

import { DrizzleItemRepository } from './drizzle-item-repository.js';

import type {
    SampleUnitOfWork,
    SampleUnitOfWorkContext,
} from '../../../application/ports/unit-of-work.js';

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
                // plop:repository-instances
                const announcementRepository = new DrizzleAnnouncementRepository(client);

                const ticketRepository = new DrizzleTicketRepository(client);

                const noteRepository = new DrizzleNoteRepository(client);

                const itemRepository = new DrizzleItemRepository(client);

                const ctx: SampleUnitOfWorkContext = {
                    // plop:repositories
                    announcements: {
                        findById: (id) => announcementRepository.findById(id),
                        add: async (announcement) => {
                            await announcementRepository.add(announcement);
                            record(...announcement.pullEvents());
                        },
                        update: async (announcement) => {
                            await announcementRepository.update(announcement);
                            record(...announcement.pullEvents());
                        },
                    },

                    tickets: {
                        findById: (id) => ticketRepository.findById(id),
                        add: async (ticket) => {
                            await ticketRepository.add(ticket);
                            record(...ticket.pullEvents());
                        },
                        update: async (ticket) => {
                            await ticketRepository.update(ticket);
                            record(...ticket.pullEvents());
                        },
                    },

                    notes: {
                        findById: (id) => noteRepository.findById(id),
                        add: async (note) => {
                            await noteRepository.add(note);
                            record(...note.pullEvents());
                        },
                        update: async (note) => {
                            await noteRepository.update(note);
                            record(...note.pullEvents());
                        },
                    },

                    items: {
                        findById: (id) => itemRepository.findById(id),
                        add: async (item) => {
                            await itemRepository.add(item);
                            record(...item.pullEvents());
                        },
                        update: async (item) => {
                            await itemRepository.update(item);
                            record(...item.pullEvents());
                        },
                    },
                };
                return body(ctx);
            },
        );
    }
}
