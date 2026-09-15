// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    stampDomainEvent,
    type Clock,
    type CrudRepositoryPort,
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
import { ConcurrentModificationError } from '../../../domain/shared/concurrent-modification-error.js';
import { DuplicateIdError } from '../../../domain/shared/duplicate-id-error.js';
import { UnitOfWorkClosedError } from '../../../domain/shared/unit-of-work-closed-error.js';
// plop:imports
import { Announcement } from '../../../domain/model/announcement/announcement.js';
import type { AnnouncementId } from '../../../domain/shared/domain-ids.js';

import { Ticket } from '../../../domain/model/ticket/ticket.js';
import type { TicketId } from '../../../domain/shared/domain-ids.js';

import { Note } from '../../../domain/model/note/note.js';
import type { NoteId } from '../../../domain/shared/domain-ids.js';

import { Item } from '../../../domain/model/item/item.js';
import type { ItemId } from '../../../domain/shared/domain-ids.js';

interface VersionedEntity<Id> {
    readonly id: Id;
    readonly version: number;
    pullEvents(): readonly DomainEventFact[];
}

/**
 * Tracks writes to one committed `Map` so a thrown `body` can roll back
 * exactly the keys this attempt touched, restoring each to its value from
 * immediately before the attempt (mirrors IAM's `FakeIamUnitOfWork`). This is
 * itself a compare-and-restore, not an unconditional one: a key is only
 * restored when its current committed value is still exactly the instance
 * this attempt itself last wrote there (reference equality), so a later,
 * already-committed attempt that built on top of it is left alone.
 */
class RollbackTrackedMap<K, V> {
    private readonly prior = new Map<K, V | undefined>();
    private readonly written = new Map<K, V>();

    constructor(private readonly committed: Map<K, V>) {}

    remember(id: K): void {
        if (!this.prior.has(id) || this.committed.get(id) !== this.written.get(id)) {
            this.prior.set(id, this.committed.get(id));
        }
    }

    write(id: K, value: V): void {
        this.committed.set(id, value);
        this.written.set(id, value);
    }

    rollback(): void {
        for (const [id, prior] of this.prior) {
            if (this.committed.get(id) !== this.written.get(id)) continue;
            if (prior === undefined) this.committed.delete(id);
            else this.committed.set(id, prior);
        }
    }
}

/** One aggregate's committed `Map` paired with this attempt's write tracker. */
interface InMemoryStore<Id, T> {
    readonly committed: Map<Id, T>;
    readonly tracker: RollbackTrackedMap<Id, T>;
}

/**
 * `createInMemoryPort`'s per-aggregate wiring: `typeName` names the aggregate
 * for {@link ConcurrentModificationError}'s message, `rehydrateAt`
 * rehydrates a fresh instance at a given version from the aggregate-specific
 * fields (used both to hand a `findById` caller a defensive copy — every
 * generated aggregate mutates in place, so two readers must never share a
 * live instance — and to bump the stored version on a successful write,
 * since this helper has no generic way to construct either itself), and
 * `closed` is shared across every aggregate's port for one `run` call so a
 * `ctx` that escaped it throws {@link UnitOfWorkClosedError} (#188) instead
 * of touching state from an attempt that already finished.
 */
interface InMemoryPortOptions<T> {
    readonly record: (...facts: readonly DomainEventFact[]) => void;
    readonly typeName: string;
    readonly rehydrateAt: (entity: T, version: number) => T;
    readonly closed: { readonly value: boolean };
}

function tryAdd<Id, T extends VersionedEntity<Id>>(
    store: InMemoryStore<Id, T>,
    entity: T,
    options: InMemoryPortOptions<T>,
): Promise<void> {
    if (store.committed.has(entity.id)) {
        return Promise.reject(new DuplicateIdError(options.typeName, String(entity.id)));
    }
    const facts = entity.pullEvents();
    store.tracker.remember(entity.id);
    store.tracker.write(entity.id, options.rehydrateAt(entity, entity.version));
    options.record(...facts);
    return Promise.resolve();
}

/**
 * Guards on `version` the same way a generated Drizzle repository does: a
 * stale `version` throws {@link ConcurrentModificationError} instead of
 * silently overwriting a concurrent change. Checks `store.committed` — the
 * live, shared `Map` — rather than a value this attempt captured when it
 * started, so a conflicting write from an attempt that started later and
 * already finished is still caught.
 */
function tryUpdate<Id, T extends VersionedEntity<Id>>(
    store: InMemoryStore<Id, T>,
    updated: T,
    options: InMemoryPortOptions<T>,
): Promise<void> {
    const current = store.committed.get(updated.id);
    if (current?.version !== updated.version) {
        return Promise.reject(
            new ConcurrentModificationError(options.typeName, String(updated.id), updated.version),
        );
    }
    const facts = updated.pullEvents();
    store.tracker.remember(updated.id);
    store.tracker.write(updated.id, options.rehydrateAt(updated, updated.version + 1));
    options.record(...facts);
    return Promise.resolve();
}

/**
 * Builds an in-memory {@link CrudRepositoryPort} over `store` — the single
 * find/duplicate-check/update shape shared by every aggregate's fake
 * repository, instead of repeated per aggregate. `findById` hands out a
 * fresh copy (via `rehydrateAt`) rather than the stored instance itself:
 * every generated aggregate mutates in place (`rename`), so returning the
 * live reference would let one reader's in-progress mutation leak into
 * another concurrent reader's copy before either has written anything back.
 */
function createInMemoryPort<Id, T extends VersionedEntity<Id>>(
    store: InMemoryStore<Id, T>,
    options: InMemoryPortOptions<T>,
): CrudRepositoryPort<Id, T> {
    const assertOpen = (operation: string): void => {
        if (options.closed.value) throw new UnitOfWorkClosedError(options.typeName, operation);
    };
    return {
        // eslint-disable-next-line @typescript-eslint/require-await -- must stay `async` so assertOpen's synchronous throw becomes a rejection (this method's Promise-typed signature), not an uncaught synchronous throw at the call site.
        findById: async (id) => {
            assertOpen('findById');
            const stored = store.committed.get(id);
            return stored === undefined ? undefined : options.rehydrateAt(stored, stored.version);
        },
        add: async (entity) => {
            assertOpen('add');
            return tryAdd(store, entity, options);
        },
        update: async (updated) => {
            assertOpen('update');
            return tryUpdate(store, updated, options);
        },
    };
}

// plop:bump-functions
function rehydrateAnnouncementAt(announcement: Announcement, version: number): Announcement {
    return Announcement.rehydrate({ id: announcement.id, name: announcement.name, version });
}

function rehydrateTicketAt(ticket: Ticket, version: number): Ticket {
    return Ticket.rehydrate({
        id: ticket.id,
        clubId: ticket.clubId,
        createdBy: ticket.createdBy,
        itemId: ticket.itemId,
        name: ticket.name,
        version,
    });
}

function rehydrateNoteAt(note: Note, version: number): Note {
    return Note.rehydrate({
        id: note.id,
        createdBy: note.createdBy,
        name: note.name,
        version,
    });
}

function rehydrateItemAt(item: Item, version: number): Item {
    return Item.rehydrate({
        id: item.id,
        clubId: item.clubId,
        createdBy: item.createdBy,
        name: item.name,
        version,
    });
}

/**
 * In-memory {@link SampleUnitOfWork} for unit-testing
 * sample-context use cases without Docker.
 *
 * Each aggregate's committed state is a `Map` that `add`/`update` mutate
 * directly (mirrors IAM's `FakeIamUnitOfWork`), not a snapshot copied at the
 * start of `run` and swapped in wholesale at the end: a version-guarded
 * `update` must see whatever is *currently* committed, even when the
 * conflicting write came from a `run` call that started later and already
 * finished — a whole-collection snapshot can't prove that without a
 * database. A `run` that throws rolls back only the keys this attempt itself
 * wrote (tracked per key by {@link RollbackTrackedMap}), rather than
 * restoring a whole-collection snapshot that could clobber an unrelated key
 * some other, already-committed attempt wrote to in the meantime (ADR-0027:
 * "a rolled-back attempt writes no rows"). Once `run` resolves, `ctx` is
 * closed (#188) — a caller that let it escape gets
 * {@link UnitOfWorkClosedError} on any further use.
 */
export class FakeSampleUnitOfWork implements SampleUnitOfWork {
    readonly recordedEvents: DomainEvent[] = [];

    // plop:state
    private readonly announcements = new Map<AnnouncementId, Announcement>();

    private readonly tickets = new Map<TicketId, Ticket>();

    private readonly notes = new Map<NoteId, Note>();

    private readonly items = new Map<ItemId, Item>();

    constructor(
        private readonly clock: Clock = new SystemClock(),
        private readonly eventIdGenerator: EventIdGenerator = new RandomEventIdGenerator(),
    ) {}

    private buildStores() {
        return {
            // plop:stores
            announcements: {
                committed: this.announcements,
                tracker: new RollbackTrackedMap(this.announcements),
            },

            tickets: {
                committed: this.tickets,
                tracker: new RollbackTrackedMap(this.tickets),
            },

            notes: {
                committed: this.notes,
                tracker: new RollbackTrackedMap(this.notes),
            },

            items: {
                committed: this.items,
                tracker: new RollbackTrackedMap(this.items),
            },
        };
    }

    private buildContext(
        stores: ReturnType<FakeSampleUnitOfWork['buildStores']>,
        record: (...facts: readonly DomainEventFact[]) => void,
        closed: { readonly value: boolean },
    ): SampleUnitOfWorkContext {
        const portDeps = { record, closed };
        return {
            // plop:repositories
            announcements: createInMemoryPort(stores.announcements, {
                ...portDeps,
                typeName: 'Announcement',
                rehydrateAt: rehydrateAnnouncementAt,
            }),

            tickets: createInMemoryPort(stores.tickets, {
                ...portDeps,
                typeName: 'Ticket',
                rehydrateAt: rehydrateTicketAt,
            }),

            notes: createInMemoryPort(stores.notes, {
                ...portDeps,
                typeName: 'Note',
                rehydrateAt: rehydrateNoteAt,
            }),

            items: createInMemoryPort(stores.items, {
                ...portDeps,
                typeName: 'Item',
                rehydrateAt: rehydrateItemAt,
            }),
        };
    }

    private rollbackStores(stores: ReturnType<FakeSampleUnitOfWork['buildStores']>): void {
        // plop:rollback
        stores.announcements.tracker.rollback();

        stores.tickets.tracker.rollback();

        stores.notes.tracker.rollback();

        stores.items.tracker.rollback();
    }

    async run<T>(
        _scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        const pendingFacts: DomainEventFact[] = [];
        const record = (...facts: readonly DomainEventFact[]): void => {
            pendingFacts.push(...facts);
        };

        const closed = { value: false };
        const stores = this.buildStores();
        const ctx = this.buildContext(stores, record, closed);

        try {
            const result = await body(ctx);
            const stampedEvents = pendingFacts.map((fact) =>
                stampDomainEvent(fact, this.eventIdGenerator.generate(), this.clock.now()),
            );
            this.recordedEvents.push(...stampedEvents);
            return result;
        } catch (error) {
            this.rollbackStores(stores);
            throw error;
        } finally {
            closed.value = true;
        }
    }
}
