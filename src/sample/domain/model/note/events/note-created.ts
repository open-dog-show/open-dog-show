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
 * The fully-qualified event-type string for {@link NoteCreated}
 * — the wire/DB form stored in the outbox `type` column and the registry key
 * the codec uses to rehydrate a stored row back into a
 * {@link NoteCreated} instance.
 */
export const NOTE_CREATED_TYPE: EventType = asEventType('sample.NoteCreated');

/** Event-type-specific structured data carried by {@link NoteCreated}. */
export interface NoteCreatedPayload {
    readonly name: string;
}

/**
 * The fact that a Note was created.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact}
 * (ADR-0027): the `type` field is fixed to
 * {@link NOTE_CREATED_TYPE}; the payload is the typed
 * {@link NoteCreatedPayload}. Carries no `eventId` /
 * `occurredAt` — those are envelope fields the unit of work stamps on
 * afterwards, from `Clock` / `EventIdGenerator` injected at the composition
 * root, never from this class or its caller (the aggregate root records
 * facts from domain data only). A private `#brand` field makes the class
 * **nominal** so a bare envelope literal is not assignable to
 * `NoteCreated`.
 *
 * Storage rehydration goes through {@link NoteCreated.rehydrate},
 * which the context's rehydration registry wires into the outbox codec /
 * polling dispatcher.
 */
export class NoteCreated implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `NoteCreated` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = NOTE_CREATED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: NoteCreatedPayload;

    private constructor(scope: EventScope, aggregateId: AggregateId, payload: NoteCreatedPayload) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs a {@link NoteCreated} fact — called by `Note.create`. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: NoteCreatedPayload,
    ): NoteCreated {
        return new NoteCreated(scope, aggregateId, payload);
    }

    /**
     * Rehydrates a {@link NoteCreated} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the context's rehydration registry.
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: NoteCreatedPayload;
    }): NoteCreated {
        return new NoteCreated(fact.scope, fact.aggregateId, fact.payload);
    }
}
