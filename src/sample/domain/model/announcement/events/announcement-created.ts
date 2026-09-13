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
 * The fully-qualified event-type string for {@link AnnouncementCreated}
 * — the wire/DB form stored in the outbox `type` column and the registry key
 * the codec uses to rehydrate a stored row back into a
 * {@link AnnouncementCreated} instance.
 */
export const ANNOUNCEMENT_CREATED_TYPE: EventType = asEventType('sample.AnnouncementCreated');

/** Event-type-specific structured data carried by {@link AnnouncementCreated}. */
export interface AnnouncementCreatedPayload {
    readonly name: string;
}

/**
 * The fact that an Announcement was created.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact}
 * (ADR-0027): the `type` field is fixed to
 * {@link ANNOUNCEMENT_CREATED_TYPE}; the payload is the typed
 * {@link AnnouncementCreatedPayload}. Carries no `eventId` /
 * `occurredAt` — those are envelope fields the unit of work stamps on
 * afterwards, from `Clock` / `EventIdGenerator` injected at the composition
 * root, never from this class or its caller (the aggregate root records
 * facts from domain data only). A private `#brand` field makes the class
 * **nominal** so a bare envelope literal is not assignable to
 * `AnnouncementCreated`.
 *
 * Storage rehydration goes through {@link AnnouncementCreated.rehydrate},
 * which the context's rehydration registry wires into the outbox codec /
 * polling dispatcher.
 */
export class AnnouncementCreated implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `AnnouncementCreated` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = ANNOUNCEMENT_CREATED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: AnnouncementCreatedPayload;

    private constructor(
        scope: EventScope,
        aggregateId: AggregateId,
        payload: AnnouncementCreatedPayload,
    ) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs a {@link AnnouncementCreated} fact — called by `Announcement.create`. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: AnnouncementCreatedPayload,
    ): AnnouncementCreated {
        return new AnnouncementCreated(scope, aggregateId, payload);
    }

    /**
     * Rehydrates a {@link AnnouncementCreated} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the context's rehydration registry.
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: AnnouncementCreatedPayload;
    }): AnnouncementCreated {
        return new AnnouncementCreated(fact.scope, fact.aggregateId, fact.payload);
    }
}
