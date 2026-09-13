// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    stampDomainEvent,
    type Clock,
    type DomainEvent,
    type DomainEventFact,
    type EventIdGenerator,
    type TransactionScope,
} from '../../../../Shared/index.js';
import { SystemClock } from '../../../../Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../Shared/infrastructure/random-event-id-generator.js';
import type {
    SampleUnitOfWork,
    SampleUnitOfWorkContext,
} from '../../../application/ports/unit-of-work.js';
// plop:imports
import { Announcement } from '../../../domain/model/announcement/announcement.js';

import { Ticket } from '../../../domain/model/ticket/ticket.js';

import { Note } from '../../../domain/model/note/note.js';

import { Item } from '../../../domain/model/item/item.js';

/**
 * In-memory {@link SampleUnitOfWork} for unit-testing
 * sample-context use cases without Docker.
 *
 * Mirrors a real transaction's atomicity: `run` copies each aggregate's
 * committed array into a staging array, hands repositories backed by the
 * staging copies to `body`, and — only once `body` resolves without throwing
 * — replaces the committed arrays with the staged ones and stamps the
 * buffered facts into {@link recordedEvents}. A `body` that throws leaves
 * every committed array untouched (ADR-0027: "a rolled-back attempt writes no
 * rows"), proven here without a database.
 */
export class FakeSampleUnitOfWork implements SampleUnitOfWork {
    readonly recordedEvents: DomainEvent[] = [];

    // plop:state
    private readonly announcements: Announcement[] = [];

    private readonly tickets: Ticket[] = [];

    private readonly notes: Note[] = [];

    private readonly items: Item[] = [];

    constructor(
        private readonly clock: Clock = new SystemClock(),
        private readonly eventIdGenerator: EventIdGenerator = new RandomEventIdGenerator(),
    ) {}

    async run<T>(
        _scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        const pendingFacts: DomainEventFact[] = [];
        const record = (...facts: readonly DomainEventFact[]): void => {
            pendingFacts.push(...facts);
        };

        // plop:staging-init
        const stagedAnnouncements: Announcement[] = this.announcements.map((announcement) =>
            Announcement.rehydrate({ id: announcement.id, name: announcement.name }),
        );

        const stagedTickets: Ticket[] = this.tickets.map((ticket) =>
            Ticket.rehydrate({
                id: ticket.id,
                clubId: ticket.clubId,
                createdBy: ticket.createdBy,
                itemId: ticket.itemId,
                name: ticket.name,
            }),
        );

        const stagedNotes: Note[] = this.notes.map((note) =>
            Note.rehydrate({
                id: note.id,
                createdBy: note.createdBy,
                name: note.name,
            }),
        );

        const stagedItems: Item[] = this.items.map((item) =>
            Item.rehydrate({
                id: item.id,
                clubId: item.clubId,
                createdBy: item.createdBy,
                name: item.name,
            }),
        );

        const ctx: SampleUnitOfWorkContext = {
            // plop:repositories
            announcements: {
                findById: async (id) =>
                    stagedAnnouncements.find((announcement) => announcement.id === id),
                add: async (announcement) => {
                    if (stagedAnnouncements.some((existing) => existing.id === announcement.id)) {
                        throw new Error('Duplicate Announcement id: ' + announcement.id);
                    }
                    stagedAnnouncements.push(announcement);
                    record(...announcement.pullEvents());
                },
                update: async (updated) => {
                    const index = stagedAnnouncements.findIndex(
                        (announcement) => announcement.id === updated.id,
                    );
                    if (index !== -1) {
                        stagedAnnouncements[index] = updated;
                    }
                    record(...updated.pullEvents());
                },
            },

            tickets: {
                findById: async (id) => stagedTickets.find((ticket) => ticket.id === id),
                add: async (ticket) => {
                    if (stagedTickets.some((existing) => existing.id === ticket.id)) {
                        throw new Error('Duplicate Ticket id: ' + ticket.id);
                    }
                    stagedTickets.push(ticket);
                    record(...ticket.pullEvents());
                },
                update: async (updated) => {
                    const index = stagedTickets.findIndex((ticket) => ticket.id === updated.id);
                    if (index !== -1) {
                        stagedTickets[index] = updated;
                    }
                    record(...updated.pullEvents());
                },
            },

            notes: {
                findById: async (id) => stagedNotes.find((note) => note.id === id),
                add: async (note) => {
                    if (stagedNotes.some((existing) => existing.id === note.id)) {
                        throw new Error('Duplicate Note id: ' + note.id);
                    }
                    stagedNotes.push(note);
                    record(...note.pullEvents());
                },
                update: async (updated) => {
                    const index = stagedNotes.findIndex((note) => note.id === updated.id);
                    if (index !== -1) {
                        stagedNotes[index] = updated;
                    }
                    record(...updated.pullEvents());
                },
            },

            items: {
                findById: async (id) => stagedItems.find((item) => item.id === id),
                add: async (item) => {
                    if (stagedItems.some((existing) => existing.id === item.id)) {
                        throw new Error('Duplicate Item id: ' + item.id);
                    }
                    stagedItems.push(item);
                    record(...item.pullEvents());
                },
                update: async (updated) => {
                    const index = stagedItems.findIndex((item) => item.id === updated.id);
                    if (index !== -1) {
                        stagedItems[index] = updated;
                    }
                    record(...updated.pullEvents());
                },
            },
        };

        const result = await body(ctx);

        // plop:commit
        this.announcements.splice(0, this.announcements.length, ...stagedAnnouncements);

        this.tickets.splice(0, this.tickets.length, ...stagedTickets);

        this.notes.splice(0, this.notes.length, ...stagedNotes);

        this.items.splice(0, this.items.length, ...stagedItems);

        for (const fact of pendingFacts) {
            this.recordedEvents.push(
                stampDomainEvent(fact, this.eventIdGenerator.generate(), this.clock.now()),
            );
        }

        return result;
    }
}
