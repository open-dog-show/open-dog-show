// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asEventType,
    type AggregateId,
    type Clock,
    type DomainEvent,
    type EventId,
    type EventIdGenerator,
    EventScope,
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
 * Modelled as a **class event** implementing {@link DomainEvent} (ADR-0022
 * class events, issue #172): the generic `DomainEvent<TPayload>` envelope +
 * `createDomainEvent` factory are retired (issue #176) now that every real
 * emitter, this one included, is class-per-type. The `type` field is fixed to
 * {@link ENTRY_SUBMITTED_TYPE}; the payload is the typed
 * {@link EntrySubmittedPayload}.
 *
 * `Clock` / `EventIdGenerator` are injected into the construction path
 * ({@link EntrySubmitted.from}) so `eventId` and `occurredAt` are deterministic
 * under test and free of hidden I/O at the call site. Explicit `eventId` /
 * `occurredAt` overrides keep the deterministic event-id/timestamp tests
 * working. A private `#brand` field makes the class **nominal** so a bare
 * envelope literal is not assignable to `EntrySubmitted`, and `instanceof` is
 * the reliable runtime discriminator for outbox consumers.
 *
 * Storage rehydration goes through {@link EntrySubmitted.rehydrate} (no ports —
 * the stored `eventId` / `occurredAt` are reused), which the sample context's
 * rehydration registry wires into the outbox codec / polling dispatcher.
 */
export class EntrySubmitted implements DomainEvent {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `EntrySubmitted` — closes the structural-literal leak
    // and makes `instanceof` the reliable discriminator.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = ENTRY_SUBMITTED_TYPE;
    readonly eventId: EventId;
    readonly occurredAt: Date;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: EntrySubmittedPayload;

    private constructor(
        eventId: EventId,
        occurredAt: Date,
        scope: EventScope,
        aggregateId: AggregateId,
        payload: EntrySubmittedPayload,
    ) {
        this.eventId = eventId;
        this.occurredAt = occurredAt;
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /**
     * Constructs an {@link EntrySubmitted} for emission, defaulting `eventId`
     * and `occurredAt` to the injected {@link Clock} / {@link EventIdGenerator}
     * ports unless overridden (e.g. tests supplying deterministic values).
     */
    static from(
        params: {
            readonly scope: EventScope;
            readonly aggregateId: AggregateId;
            readonly payload: EntrySubmittedPayload;
            /** Override the generated id (useful in tests). */
            readonly eventId?: EventId | undefined;
            /** Override the timestamp (useful in tests). */
            readonly occurredAt?: Date | undefined;
        },
        deps: { readonly clock: Clock; readonly eventIdGenerator: EventIdGenerator },
    ): EntrySubmitted {
        return new EntrySubmitted(
            params.eventId ?? deps.eventIdGenerator.generate(),
            params.occurredAt ?? deps.clock.now(),
            params.scope,
            params.aggregateId,
            params.payload,
        );
    }

    /**
     * Rehydrates an {@link EntrySubmitted} from a stored envelope — the path
     * the outbox codec / polling dispatcher use via the sample context's
     * rehydration registry. No ports: the stored `eventId` / `occurredAt` are
     * reused verbatim. The `payload` is narrowed from `unknown` at this
     * boundary (the codec cannot validate a payload shape it knows nothing
     * about).
     */
    static rehydrate(envelope: {
        readonly eventId: EventId;
        readonly occurredAt: Date;
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: EntrySubmittedPayload;
    }): EntrySubmitted {
        return new EntrySubmitted(
            envelope.eventId,
            envelope.occurredAt,
            envelope.scope,
            envelope.aggregateId,
            envelope.payload,
        );
    }
}
