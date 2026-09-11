// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent } from './domain-event.js';
import type { EventScope } from './event-scope.js';
import { asEventScope } from './event-scope.js';
import {
    asAggregateId,
    asEventId,
    asEventType,
    type AggregateId,
    type EventId,
    type EventType,
} from './domain-ids.js';

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
 * The envelope fields after the boundary casts in {@link rehydrateDomainEvent} —
 * branded ids restored, `occurredAt` normalised to a `Date`, `scope` rebuilt as
 * an {@link EventScope}. This is the shape a {@link DomainEventRehydrator}
 * receives so a class-event rehydrator can construct its class directly from
 * already-validated values instead of re-running the casts.
 */
export interface RehydratedDomainEventEnvelope {
    readonly eventId: EventId;
    readonly type: EventType;
    readonly occurredAt: Date;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    /**
     * Event-type-specific structured data, still `unknown`: the codec cannot
     * validate a payload shape it knows nothing about. A class-event
     * rehydrator narrows the payload to its own typed shape at its own
     * boundary — mirroring how {@link decodeDomainEvent} returns
     * `DomainEvent<unknown>`.
     */
    readonly payload: unknown;
}

/**
 * Rehydrates a {@link DomainEvent} from a {@link RehydratedDomainEventEnvelope}
 * — i.e. constructs the concrete class event (e.g. `EntrySubmitted`) from
 * already-validated envelope fields. Registered in a
 * {@link DomainEventRehydrationRegistry} keyed by event-type string so the
 * outbox codec / polling dispatcher consume class events rather than the
 * generic `DomainEvent<unknown>` envelope.
 */
export type DomainEventRehydrator = (
    envelope: RehydratedDomainEventEnvelope,
) => DomainEvent<unknown>;

/**
 * Event-type → class rehydration registry (ADR-0022 class events).
 *
 * Maps an event-type string (e.g. `'sample.EntrySubmitted'`) to the
 * {@link DomainEventRehydrator} that constructs the concrete class event from
 * the rehydrated envelope. The registry is populated by a context's composition
 * root (the kernel cannot import a context's event classes), then passed to the
 * outbox codec / polling dispatcher so a stored row is rehydrated back into its
 * class instance instead of the generic `DomainEvent<unknown>` envelope. An
 * unregistered type falls through to the generic envelope, so the registry is
 * opt-in per event type — retiring the envelope model for one emitter does not
 * require converting every emitter at once.
 */
export class DomainEventRehydrationRegistry {
    private readonly rehydrators = new Map<string, DomainEventRehydrator>();

    /** Associate `type` with the rehydrator that builds its class event. */
    register(type: EventType, rehydrator: DomainEventRehydrator): void {
        this.rehydrators.set(type, rehydrator);
    }

    /** Returns the rehydrator for `type`, or `undefined` when none is registered. */
    rehydratorFor(type: EventType): DomainEventRehydrator | undefined {
        return this.rehydrators.get(type);
    }
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
 *
 * When a `registry` is supplied and it has a rehydrator for the row's
 * `type`, that rehydrator constructs the concrete class event (e.g.
 * `EntrySubmitted`) from the already-validated envelope — so the polling
 * dispatcher consumes class events. Otherwise the generic
 * `DomainEvent<unknown>` envelope is returned, keeping the codec usable for
 * event types that have not yet been migrated to class events.
 */
export function rehydrateDomainEvent(
    envelope: {
        readonly eventId: string;
        readonly type: string;
        readonly occurredAt: Date | string;
        readonly scope: string;
        readonly aggregateId: string;
        readonly payload: unknown;
    },
    registry?: DomainEventRehydrationRegistry,
): DomainEvent<unknown> {
    // Restore the timestamp first so a corrupt value is rejected at the
    // boundary. For the string path a strict ISO parse (see parseStrictIso above)
    // rejects both non-ISO garbage (→ Invalid Date) and rollover dates that
    // `new Date` would silently normalise (e.g. `2026-02-30` → March 2); for the
    // `Date` path (pg driver) an explicit NaN check is still required —
    // mirroring the asEventType / asEventScope reject-at-the-boundary contract.
    const occurredAt = normalizeOccurredAt(envelope.occurredAt);
    const type = asEventType(envelope.type);
    const scope = asEventScope(envelope.scope);
    const eventId = asEventId(envelope.eventId);
    const aggregateId = asAggregateId(envelope.aggregateId);

    const rehydrator = registry?.rehydratorFor(type);
    if (rehydrator !== undefined) {
        return rehydrator({
            eventId,
            type,
            occurredAt,
            scope,
            aggregateId,
            payload: envelope.payload,
        });
    }
    return { eventId, type, occurredAt, scope, aggregateId, payload: envelope.payload };
}

/**
 * Normalises `occurredAt` to a `Date`, rejecting corrupt values at the boundary:
 * a `Date` from the `pg` driver may be an Invalid Date (`getTime()` `NaN`),
 * while a string is parsed strictly (see {@link parseStrictIso}) so non-ISO
 * input and rollover dates never propagate as a subtly-wrong typed event.
 */
function normalizeOccurredAt(value: Date | string): Date {
    const occurredAt = value instanceof Date ? value : parseStrictIso(value);
    if (Number.isNaN(occurredAt.getTime())) {
        throw new InvalidDomainEventEnvelopeError('occurredAt', value);
    }
    return occurredAt;
}
