// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent } from './domain-event.js';
import { asEventScope } from './domain-event.js';
import { asAggregateId, asEventId, asEventType } from './domain-ids.js';

/** The serialised (JSON-safe) form of a {@link DomainEvent}. */
export interface DomainEventJson {
    readonly eventId: string;
    readonly type: string;
    /** ISO-8601 timestamp. */
    readonly occurredAt: string;
    /** Raw scope string — validated back to {@link EventScope} by {@link decodeDomainEvent}. */
    readonly scope: string;
    readonly aggregateId: string;
    readonly payload: unknown;
}

/**
 * Encode a {@link DomainEvent} to a JSON-safe object.
 *
 * The `occurredAt` Date is converted to an ISO-8601 string; everything else
 * is left as-is (branded string ids are plain strings at runtime).
 */
export function encodeDomainEvent<TPayload>(event: DomainEvent<TPayload>): DomainEventJson {
    return {
        eventId: event.eventId,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        scope: event.scope,
        aggregateId: event.aggregateId,
        payload: event.payload,
    };
}

/**
 * Decode a {@link DomainEventJson} back to a {@link DomainEvent}.
 *
 * The `occurredAt` ISO-8601 string is restored to a `Date`.  The `eventId`,
 * `type`, and `aggregateId` cross back from untyped JSON strings into their
 * branded forms via {@link asEventId} / {@link asEventType} /
 * {@link asAggregateId}; `asEventType` validates the `<context>.<PascalName>`
 * format so a malformed outbox row is rejected at the boundary rather than
 * propagated as a typed event.
 *
 * The `payload` is returned as `unknown`: the codec cannot validate a payload
 * shape it knows nothing about, so it deliberately does **not** advertise a
 * `<TPayload>` type parameter.  Callers narrow the payload at their own
 * boundary — mirroring how the {@link PgPollingDispatcher} already consumes a
 * `DomainEvent<unknown>` from the outbox.
 */
export function decodeDomainEvent(json: DomainEventJson): DomainEvent<unknown> {
    return rehydrateDomainEvent(json);
}

/**
 * Rehydrates a {@link DomainEvent} from already-decoded envelope fields,
 * crossing the untyped strings back into their branded forms and normalising
 * `occurredAt` (a `Date` from the `pg` driver, or an ISO string from JSON).
 *
 * The single source of the boundary casts so the outbox-row mapper
 * (`PgPollingDispatcher.outboxRowToEvent`) and the JSON codec
 * ({@link decodeDomainEvent}) do not re-implement the `asEventId` /
 * `asEventType` / `asEventScope` / `asAggregateId` casts.
 */
export function rehydrateDomainEvent(envelope: {
    readonly eventId: string;
    readonly type: string;
    readonly occurredAt: Date | string;
    readonly scope: string;
    readonly aggregateId: string;
    readonly payload: unknown;
}): DomainEvent<unknown> {
    return {
        eventId: asEventId(envelope.eventId),
        type: asEventType(envelope.type),
        occurredAt:
            envelope.occurredAt instanceof Date
                ? envelope.occurredAt
                : new Date(envelope.occurredAt),
        scope: asEventScope(envelope.scope),
        aggregateId: asAggregateId(envelope.aggregateId),
        payload: envelope.payload,
    };
}
