// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asEventType,
    type AggregateId,
    type DomainEventFact,
    type EventScope,
    type EventType,
} from '../../../../../Shared/index.js';

/**
 * The fully-qualified event-type string for {@link TicketRenamed}
 * — the wire/DB form stored in the outbox `type` column and the registry key
 * the codec uses to rehydrate a stored row back into a
 * {@link TicketRenamed} instance.
 */
export const TICKET_RENAMED_TYPE: EventType = asEventType('sample.TicketRenamed');

/** Event-type-specific structured data carried by {@link TicketRenamed}. */
export interface TicketRenamedPayload {
    readonly name: string;
}

/**
 * The fact that a Ticket was renamed.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact}
 * (ADR-0027): the `type` field is fixed to
 * {@link TICKET_RENAMED_TYPE}; the payload is the typed
 * {@link TicketRenamedPayload}. Carries no `eventId` /
 * `occurredAt` — those are envelope fields the unit of work stamps on
 * afterwards. A private `#brand` field makes the class **nominal** so a bare
 * envelope literal is not assignable to `TicketRenamed`.
 *
 * Storage rehydration goes through {@link TicketRenamed.rehydrate},
 * which the context's rehydration registry wires into the outbox codec /
 * polling dispatcher.
 */
export class TicketRenamed implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `TicketRenamed` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = TICKET_RENAMED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: TicketRenamedPayload;

    private constructor(
        scope: EventScope,
        aggregateId: AggregateId,
        payload: TicketRenamedPayload,
    ) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs a {@link TicketRenamed} fact — called by `Ticket.rename`. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: TicketRenamedPayload,
    ): TicketRenamed {
        return new TicketRenamed(scope, aggregateId, payload);
    }

    /**
     * Rehydrates a {@link TicketRenamed} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the context's rehydration registry.
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: TicketRenamedPayload;
    }): TicketRenamed {
        return new TicketRenamed(fact.scope, fact.aggregateId, fact.payload);
    }
}
