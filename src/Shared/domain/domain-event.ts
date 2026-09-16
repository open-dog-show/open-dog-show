// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { EventId, EventType, AggregateId } from './domain-ids.js';
import type { EventScope } from './event-scope.js';

/**
 * The fact an aggregate root records — everything a root can know at the
 * moment it happens, before the unit of work stamps an envelope around it
 * (ADR-0027).
 *
 * This is a marker interface implemented by class-per-event-type domain
 * events (ADR-0022, e.g. `EntrySubmitted`) — it carries no generic payload
 * parameter. A concrete event class narrows `payload` from `unknown` to its
 * own typed shape, and fixes its `type` to a constant. Constructed from
 * domain data only: no `Clock` / `EventIdGenerator` port is involved.
 */
export interface DomainEventFact {
    /** Fully-qualified event type name, e.g. `'entries.EntrySubmitted'`. */
    readonly type: EventType;
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

/**
 * The stored envelope around a {@link DomainEventFact}: an immutable record of
 * something that has already happened in the domain, and been durably
 * assigned an identity and a timestamp.
 *
 * The unit of work pulls facts from an aggregate root (`AggregateRoot.pullEvents`)
 * and stamps `eventId` / `occurredAt` onto each before writing it to the
 * outbox (ADR-0027); the outbox codec and the polling dispatcher work
 * exclusively on this envelope shape, never on the bare fact.
 */
export interface DomainEvent extends DomainEventFact {
    /**
     * Stable, globally-unique identifier for this event occurrence.
     *
     * Acts as the idempotency key: the outbox writer uses
     * `ON CONFLICT (event_id) DO NOTHING` so that replaying the **same
     * `DomainEvent` object** (with its original `eventId`) never produces a
     * duplicate outbox row.  A freshly stamped event carries a different
     * `eventId` and the conflict guard offers no protection.
     */
    readonly eventId: EventId;
    /** Wall-clock instant at which the fact occurred. */
    readonly occurredAt: Date;
}

/**
 * Stamps `eventId` / `occurredAt` onto a {@link DomainEventFact}, producing
 * the {@link DomainEvent} the outbox writer / codec / dispatcher work with.
 *
 * Builds the envelope on a **new object sharing the fact's prototype**
 * (`Object.create(Object.getPrototypeOf(fact))`) rather than a plain
 * `{ ...fact, eventId, occurredAt }` spread, so `instanceof EntrySubmitted`
 * (the concrete event class) still holds for the stamped/rehydrated event —
 * a plain spread would silently drop the prototype and defeat the
 * `instanceof` discriminator the class events rely on (ADR-0022). The
 * `#brand` private field is not an own enumerable property either way, so it
 * is never copied — only the class identity (prototype) is preserved.
 *
 * The single stamping path shared by the unit-of-work's `record` (fresh
 * facts) and {@link rehydrateDomainEvent} (facts rebuilt from storage).
 */
export function stampDomainEvent(
    fact: DomainEventFact,
    eventId: EventId,
    occurredAt: Date,
): DomainEvent {
    return Object.assign(Object.create(Object.getPrototypeOf(fact) as object), fact, {
        eventId,
        occurredAt,
    }) as DomainEvent;
}
