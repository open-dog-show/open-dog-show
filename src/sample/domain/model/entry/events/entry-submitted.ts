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
 * The fully-qualified event-type string for {@link EntrySubmitted} — the wire/DB
 * form stored in the outbox `type` column and the registry key the codec uses
 * to rehydrate a stored row back into an {@link EntrySubmitted} instance.
 */
export const ENTRY_SUBMITTED_TYPE: EventType = asEventType('sample.EntrySubmitted');

/**
 * Event-type-specific structured data carried by {@link EntrySubmitted}.
 */
export interface EntrySubmittedPayload {
    readonly dogName: string;
}

/**
 * The fact that an {@link Entry} was submitted to a Show.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact} (ADR-0027):
 * the `type` field is fixed to {@link ENTRY_SUBMITTED_TYPE}; the payload is
 * the typed {@link EntrySubmittedPayload}. Carries no `eventId` / `occurredAt`
 * — those are envelope fields the unit of work stamps on afterwards, from
 * `Clock` / `EventIdGenerator` injected at the composition root, never from
 * this class or its caller (the aggregate root records facts from domain
 * data only). A private `#brand` field makes the class **nominal** so a bare
 * envelope literal is not assignable to `EntrySubmitted`.
 *
 * Storage rehydration goes through {@link EntrySubmitted.rehydrate}, which the
 * sample context's rehydration registry wires into the outbox codec /
 * polling dispatcher.
 */
export class EntrySubmitted implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `EntrySubmitted` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = ENTRY_SUBMITTED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: EntrySubmittedPayload;

    private constructor(
        scope: EventScope,
        aggregateId: AggregateId,
        payload: EntrySubmittedPayload,
    ) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs an {@link EntrySubmitted} fact — called by `Entry.submit`. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: EntrySubmittedPayload,
    ): EntrySubmitted {
        return new EntrySubmitted(scope, aggregateId, payload);
    }

    /**
     * Rehydrates an {@link EntrySubmitted} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the sample context's rehydration registry. The
     * `payload` is narrowed from `unknown` at this boundary (the codec cannot
     * validate a payload shape it knows nothing about).
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: EntrySubmittedPayload;
    }): EntrySubmitted {
        return new EntrySubmitted(fact.scope, fact.aggregateId, fact.payload);
    }
}
