// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { EventId, EventType, AggregateId } from './domain-ids.js';
import type { EventScope } from './event-scope.js';

/**
 * An immutable record of something that has already happened in the domain.
 *
 * Domain events are facts — they describe state changes that have already
 * occurred, not commands or intentions. Once created, a `DomainEvent` must
 * never be mutated.
 *
 * This is a marker interface implemented by class-per-event-type domain
 * events (ADR-0022, e.g. {@link EntrySubmitted}) — it carries no generic
 * payload parameter. A concrete event class narrows `payload` from `unknown`
 * to its own typed shape.
 */
export interface DomainEvent {
    /**
     * Stable, globally-unique identifier for this event occurrence.
     *
     * Acts as the idempotency key: the outbox writer uses
     * `ON CONFLICT (event_id) DO NOTHING` so that replaying the **same
     * `DomainEvent` object** (with its original `eventId`) never produces a
     * duplicate outbox row.  A freshly constructed event carries a different
     * `eventId` and the conflict guard offers no protection.
     */
    readonly eventId: EventId;
    /** Fully-qualified event type name, e.g. `'entries.EntrySubmitted'`. */
    readonly type: EventType;
    /** Wall-clock instant at which the fact occurred. */
    readonly occurredAt: Date;
    /** Ownership classification — see {@link EventScope}. */
    readonly scope: EventScope;
    /**
     * ID of the aggregate root that produced this event.
     *
     * Context-neutral branded id: the kernel cannot know which
     * context-specific brand an aggregate id carries, so a generic
     * {@link AggregateId} is used here.  Contexts may narrow further at their
     * own boundary.
     */
    readonly aggregateId: AggregateId;
    /**
     * Event-type-specific structured data.
     *
     * `unknown` on the marker interface — a concrete event class redeclares
     * this field with its own typed payload shape.
     */
    readonly payload: unknown;
}
