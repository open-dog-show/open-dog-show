// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent } from './domain-event.js';
import { asEventScope } from './event-scope.js';
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
 * Thrown by {@link rehydrateDomainEvent} when an envelope field cannot be
 * restored to a valid domain value — currently the `occurredAt` timestamp: the
 * string path is parsed strictly (see {@link parseStrictIso}), which rejects
 * non-ISO input and rollover dates, while a `Date` from the `pg` driver may
 * still be an Invalid Date (`getTime()` `NaN`), caught by an explicit check.
 *
 * Rejecting at the boundary mirrors {@link asEventType} / {@link asEventScope}:
 * a malformed outbox row or JSON envelope must never propagate as a typed
 * {@link DomainEvent} carrying an unusable timestamp. This is a
 * technical/boundary error (corrupt data, not a domain-rule violation), so it
 * extends `Error` rather than {@link DomainError}; `field` names which envelope
 * field was unrecoverable and `value` the offending input.
 */
export class InvalidDomainEventEnvelopeError extends Error {
    readonly field: string;
    readonly value: unknown;

    constructor(field: string, value: unknown) {
        super(
            `Invalid DomainEvent envelope: '${field}' could not be restored (got ${String(value)})`,
        );
        this.name = 'InvalidDomainEventEnvelopeError';
        this.field = field;
        this.value = value;
    }
}

/**
 * Encode a {@link DomainEvent} to a JSON-safe object.
 *
 * The `occurredAt` Date is converted to an ISO-8601 string; the `EventScope`
 * is flattened to its `kind` tag (the wire form — rehydrated by
 * {@link decodeDomainEvent} via {@link asEventScope}); everything else is left
 * as-is (branded string ids are plain strings at runtime).
 */
export function encodeDomainEvent<TPayload>(event: DomainEvent<TPayload>): DomainEventJson {
    return {
        eventId: event.eventId,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        scope: event.scope.kind,
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
 * Strictly parse an ISO-8601 UTC timestamp, rejecting values `new Date(string)`
 * would silently normalise — both non-ISO garbage (→ Invalid Date) and rollover
 * dates such as `2026-02-30T00:00:00.000Z` (→ March 2). Mirrors the `LocalDate`
 * round-trip check: capture the fields with a strict regex, build the instant
 * via `Date.UTC`, and reject when the round-tripped UTC components do not match
 * the inputs. Throws {@link InvalidDomainEventEnvelopeError} on any mismatch.
 */
function parseStrictIso(value: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/.exec(value);
    if (!m) throw new InvalidDomainEventEnvelopeError('occurredAt', value);
    const ms = m[7];
    const d = new Date(
        Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!, ms ? +ms.slice(1) : 0),
    );
    if (
        d.getUTCFullYear() !== +m[1]! ||
        d.getUTCMonth() !== +m[2]! - 1 ||
        d.getUTCDate() !== +m[3]! ||
        d.getUTCHours() !== +m[4]! ||
        d.getUTCMinutes() !== +m[5]! ||
        d.getUTCSeconds() !== +m[6]!
    )
        throw new InvalidDomainEventEnvelopeError('occurredAt', value);
    return d;
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
    // Restore the timestamp first so a corrupt value is rejected at the
    // boundary. For the string path a strict ISO parse (see parseStrictIso above)
    // rejects both non-ISO garbage (→ Invalid Date) and rollover dates that
    // `new Date` would silently normalise (e.g. `2026-02-30` → March 2); for the
    // `Date` path (pg driver) an explicit NaN check is still required —
    // mirroring the asEventType / asEventScope reject-at-the-boundary contract.
    const occurredAt =
        envelope.occurredAt instanceof Date
            ? envelope.occurredAt
            : parseStrictIso(envelope.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
        throw new InvalidDomainEventEnvelopeError('occurredAt', envelope.occurredAt);
    }
    return {
        eventId: asEventId(envelope.eventId),
        type: asEventType(envelope.type),
        occurredAt,
        scope: asEventScope(envelope.scope),
        aggregateId: asAggregateId(envelope.aggregateId),
        payload: envelope.payload,
    };
}
