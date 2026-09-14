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

interface InMemoryCrudPort<Id, T> {
    findById(id: Id): Promise<T | undefined>;
    add(entity: T): Promise<void>;
    update(entity: T): Promise<void>;
}

/**
 * Builds an in-memory {@link InMemoryCrudPort} over `staged` — the single
 * find/duplicate-check/update shape shared by every aggregate's fake
 * repository, instead of repeated per aggregate.
 */
function createInMemoryPort<
    Id,
    T extends { readonly id: Id; pullEvents(): readonly DomainEventFact[] },
>(
    staged: T[],
    record: (...facts: readonly DomainEventFact[]) => void,
    typeName: string,
): InMemoryCrudPort<Id, T> {
    return {
        findById: (id) => Promise.resolve(staged.find((entity) => entity.id === id)),
        add: (entity) => {
            if (staged.some((existing) => existing.id === entity.id)) {
                return Promise.reject(new Error(`Duplicate ${typeName} id: ${String(entity.id)}`));
            }
            staged.push(entity);
            record(...entity.pullEvents());
            return Promise.resolve();
        },
        update: (updated) => {
            const index = staged.findIndex((entity) => entity.id === updated.id);
            if (index !== -1) staged[index] = updated;
            record(...updated.pullEvents());
            return Promise.resolve();
        },
    };
}

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

    // plop:staging-methods
    private stageAnnouncements() {
        return this.announcements.map((announcement) =>
            Announcement.rehydrate({ id: announcement.id, name: announcement.name }),
        );
    }

    private stageTickets() {
        return this.tickets.map((ticket) =>
            Ticket.rehydrate({
                id: ticket.id,
                clubId: ticket.clubId,
                createdBy: ticket.createdBy,
                itemId: ticket.itemId,
                name: ticket.name,
            }),
        );
    }

    private stageNotes() {
        return this.notes.map((note) =>
            Note.rehydrate({
                id: note.id,
                createdBy: note.createdBy,
                name: note.name,
            }),
        );
    }

    private stageItems() {
        return this.items.map((item) =>
            Item.rehydrate({
                id: item.id,
                clubId: item.clubId,
                createdBy: item.createdBy,
                name: item.name,
            }),
        );
    }

    private stageAll() {
        return {
            // plop:staging-init
            announcements: this.stageAnnouncements(),

            tickets: this.stageTickets(),

            notes: this.stageNotes(),

            items: this.stageItems(),
        };
    }

    private buildContext(
        staged: ReturnType<FakeSampleUnitOfWork['stageAll']>,
        record: (...facts: readonly DomainEventFact[]) => void,
    ): SampleUnitOfWorkContext {
        return {
            // plop:repositories
            announcements: createInMemoryPort(staged.announcements, record, 'Announcement'),

            tickets: createInMemoryPort(staged.tickets, record, 'Ticket'),

            notes: createInMemoryPort(staged.notes, record, 'Note'),

            items: createInMemoryPort(staged.items, record, 'Item'),
        };
    }

    private commitAll(staged: ReturnType<FakeSampleUnitOfWork['stageAll']>): void {
        // plop:commit
        this.announcements.splice(0, this.announcements.length, ...staged.announcements);

        this.tickets.splice(0, this.tickets.length, ...staged.tickets);

        this.notes.splice(0, this.notes.length, ...staged.notes);

        this.items.splice(0, this.items.length, ...staged.items);
    }

    async run<T>(
        _scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        const pendingFacts: DomainEventFact[] = [];
        const record = (...facts: readonly DomainEventFact[]): void => {
            pendingFacts.push(...facts);
        };

        const staged = this.stageAll();
        const ctx = this.buildContext(staged, record);
        const result = await body(ctx);
        this.commitAll(staged);

        for (const fact of pendingFacts) {
            this.recordedEvents.push(
                stampDomainEvent(fact, this.eventIdGenerator.generate(), this.clock.now()),
            );
        }

        return result;
    }
}
