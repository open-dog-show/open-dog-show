// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEventFact } from './domain-event.js';

/**
 * Base class for aggregate roots that record domain events (ADR-0027).
 *
 * A mutator constructs the event from domain data only — e.g.
 * `this.record(new ItemRenamed(this.id, name, ClubEventScope.of(this.clubId)))`
 * — and calls the protected {@link record}. No `Clock` / `EventIdGenerator`
 * port reaches the aggregate: the unit of work pulls the recorded facts via
 * {@link pullEvents}, stamps `eventId` / `occurredAt`, and writes them to the
 * outbox in the same transaction (ADR-0027).
 */
export abstract class AggregateRoot {
    readonly #events: DomainEventFact[] = [];

    /** Records a fact produced by this aggregate. Call only from a mutator. */
    protected record(event: DomainEventFact): void {
        this.#events.push(event);
    }

    /**
     * Returns every fact recorded since the last call, and clears the
     * internal buffer — a second call returns an empty array until more
     * facts are recorded.
     */
    pullEvents(): ReadonlyArray<DomainEventFact> {
        return this.#events.splice(0, this.#events.length);
    }
}
