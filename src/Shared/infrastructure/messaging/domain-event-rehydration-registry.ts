// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    stampDomainEvent,
    type DomainEvent,
    type DomainEventFact,
} from '../../domain/domain-event.js';
import { asEventScope } from '../../domain/event-scope.js';
import { asAggregateId, asEventId, asEventType, type EventType } from '../../domain/domain-ids.js';

/**
 * Reconstructs a {@link DomainEventFact} (e.g. `EntrySubmitted`) from
 * already-validated envelope fields. Registered in a
 * {@link DomainEventRehydrationRegistry} keyed by event-type string so the
 * polling dispatcher receives whatever this rehydrator constructs — by
 * convention, and in every rehydrator in this repo, a concrete class
 * instance; the registry itself has no way to verify that a given
 * implementation actually does so.
 *
 * The rehydrator receives only the fact fields (`type`, `scope`,
 * `aggregateId`, `payload`) — `eventId` / `occurredAt` are envelope-only
 * fields the caller ({@link rehydrateDomainEvent}) attaches afterwards
 * (ADR-0027: the codec and dispatcher work on the envelope, the fact stays
 * ignorant of it).
 */
export type DomainEventRehydrator = (fact: DomainEventFact) => DomainEventFact;

/**
 * Event-type → class rehydration registry (ADR-0022 class events).
 *
 * Maps an event-type string (e.g. `'sample.EntrySubmitted'`) to the
 * {@link DomainEventRehydrator} that constructs the concrete class event from
 * the rehydrated fact fields. The registry is populated by a context's composition
 * root (the kernel cannot import a context's event classes), then passed to the
 * polling dispatcher so a stored row is rehydrated back into its
 * class instance. An unregistered type is rejected by {@link rehydrateDomainEvent}
 * — the envelope-event model is retired (ADR-0022/#176), so every event type a
 * context actually emits must be registered.
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
 * a malformed outbox row must never propagate as a typed {@link DomainEvent}
 * carrying an unusable timestamp. This is a technical/boundary error (corrupt
 * data, not a domain-rule violation), so it extends `Error` rather than
 * `DomainError`; `field` names which envelope field was unrecoverable and
 * `value` the offending input.
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
 * Thrown by {@link rehydrateDomainEvent} when a stored row's `type` has no
 * registered {@link DomainEventRehydrator}.
 *
 * The envelope-event model is retired (ADR-0022, issue #176): rehydration no
 * longer falls back to a generic `DomainEvent` literal for an unrecognised
 * type, so every event type a context actually emits must be registered in
 * the {@link DomainEventRehydrationRegistry} passed to the dispatcher. An
 * unregistered type is a wiring bug (a new event class shipped without
 * updating the context's registry), not recoverable outbox-row corruption —
 * hence a dedicated error rather than {@link InvalidDomainEventEnvelopeError}.
 */
export class UnregisteredDomainEventTypeError extends Error {
    readonly type: EventType;

    constructor(type: EventType) {
        super(
            `No DomainEventRehydrator registered for event type '${type}' — register one in this context's DomainEventRehydrationRegistry.`,
        );
        this.name = 'UnregisteredDomainEventTypeError';
        this.type = type;
    }
}

interface IsoComponents {
    readonly year: string;
    readonly month: string;
    readonly day: string;
    readonly hour: string;
    readonly minute: string;
    readonly second: string;
    readonly ms: string | undefined;
}

// The fixed pattern in `parseStrictIso` always captures these six groups when
// `m` is non-null; this check exists so their type is `string`, not `string |
// undefined`, without a non-null assertion.
function requireIsoComponents(m: RegExpExecArray, raw: string): IsoComponents {
    const [, year, month, day, hour, minute, second, ms] = m;
    if (
        year === undefined ||
        month === undefined ||
        day === undefined ||
        hour === undefined ||
        minute === undefined ||
        second === undefined
    ) {
        throw new InvalidDomainEventEnvelopeError('occurredAt', raw);
    }
    return { year, month, day, hour, minute, second, ms };
}

function toUtcDate(c: IsoComponents): Date {
    return new Date(
        Date.UTC(
            +c.year,
            +c.month - 1,
            +c.day,
            +c.hour,
            +c.minute,
            +c.second,
            c.ms ? +c.ms.slice(1) : 0,
        ),
    );
}

function isRoundTripMismatch(roundTripped: Date, c: IsoComponents): boolean {
    return (
        roundTripped.getUTCFullYear() !== +c.year ||
        roundTripped.getUTCMonth() !== +c.month - 1 ||
        roundTripped.getUTCDate() !== +c.day ||
        roundTripped.getUTCHours() !== +c.hour ||
        roundTripped.getUTCMinutes() !== +c.minute ||
        roundTripped.getUTCSeconds() !== +c.second
    );
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
    const components = requireIsoComponents(m, value);
    const d = toUtcDate(components);
    if (isRoundTripMismatch(d, components)) {
        throw new InvalidDomainEventEnvelopeError('occurredAt', value);
    }
    return d;
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

/**
 * Rehydrates a {@link DomainEvent} from already-decoded envelope fields,
 * crossing the untyped strings back into their branded forms and normalising
 * `occurredAt` (a `Date` from the `pg` driver, or an ISO string).
 *
 * The single source of the boundary casts so the outbox-row mapper
 * (`PgPollingDispatcher.outboxRowToEvent`) does not re-implement the
 * `asEventId` / `asEventType` / `asEventScope` / `asAggregateId` casts.
 *
 * The registered rehydrator only ever sees the **fact** — `type`, `scope`,
 * `aggregateId`, `payload` — never `eventId`/`occurredAt` (ADR-0027): this
 * function attaches those two envelope-only fields to the rehydrated fact
 * afterwards, so the returned value satisfies `DomainEvent`.
 *
 * `registry` must have a rehydrator registered for the row's `type` — by
 * convention that rehydrator constructs the concrete class event (e.g.
 * `EntrySubmitted`) from the already-validated fact, so the polling
 * dispatcher receives a class instance rather than a bare envelope literal
 * (ADR-0022, #176) — though this function has no way to verify that a
 * registered rehydrator actually does so. An unregistered `type` throws
 * {@link UnregisteredDomainEventTypeError} rather than falling back to a
 * generic envelope literal — that fallback was the last envelope-event
 * remnant and is retired now that every real emitter is class-per-type.
 */
export function rehydrateDomainEvent(
    envelope: {
        readonly eventId: string;
        readonly type: string;
        readonly occurredAt: Date | string;
        readonly scope: string;
        readonly clubId: string | null;
        readonly principalId: string | null;
        readonly aggregateId: string;
        readonly payload: unknown;
    },
    registry: DomainEventRehydrationRegistry,
): DomainEvent {
    // Restore the timestamp first so a corrupt value is rejected at the
    // boundary. For the string path a strict ISO parse (see parseStrictIso above)
    // rejects both non-ISO garbage (→ Invalid Date) and rollover dates that
    // `new Date` would silently normalise (e.g. `2026-02-30` → March 2); for the
    // `Date` path (pg driver) an explicit NaN check is still required —
    // mirroring the asEventType / asEventScope reject-at-the-boundary contract.
    const occurredAt = normalizeOccurredAt(envelope.occurredAt);
    const type = asEventType(envelope.type);
    const scope = asEventScope(envelope.scope, envelope.clubId, envelope.principalId);
    const eventId = asEventId(envelope.eventId);
    const aggregateId = asAggregateId(envelope.aggregateId);

    const rehydrator = registry.rehydratorFor(type);
    if (rehydrator === undefined) {
        throw new UnregisteredDomainEventTypeError(type);
    }
    const fact = rehydrator({ type, scope, aggregateId, payload: envelope.payload });
    return stampDomainEvent(fact, eventId, occurredAt);
}
