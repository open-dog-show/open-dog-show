// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Clock, IdGenerator } from './domain-ports.js';

/**
 * The data-ownership scope of a recorded domain event — see `CONTEXT.md`
 * **Data-Ownership Scope** and ADR-0005.
 *
 * - `'tenant'`    — fact belongs to one Club; carries `tenant_id` + `user_id`.
 * - `'exhibitor'` — fact belongs to an Exhibitor acting cross-tenant; carries `user_id` only.
 * - `'platform'`  — fact is platform-scoped; no tenant or user isolation.
 *
 * This is **not** the same as `TransactionScope`, which describes the
 * database-transaction context.  An event's `EventScope` is immutable once
 * recorded; `TransactionScope` is ephemeral and lives only for the duration
 * of one unit-of-work.
 */
export type EventScope = 'tenant' | 'exhibitor' | 'platform';

/**
 * An immutable record of something that has already happened in the domain.
 *
 * Domain events are facts — they describe state changes that have already
 * occurred, not commands or intentions.  Once created, a `DomainEvent` must
 * never be mutated.
 *
 * @typeParam TPayload - The structured data specific to this event type.
 */
export interface DomainEvent<TPayload> {
    /**
     * Stable, globally-unique identifier for this event occurrence.
     *
     * Acts as the idempotency key: the outbox writer uses
     * `ON CONFLICT (event_id) DO NOTHING` so that replaying the **same
     * `DomainEvent` object** (with its original `eventId`) never produces a
     * duplicate outbox row.  A freshly constructed event carries a different
     * `eventId` and the conflict guard offers no protection.
     */
    readonly eventId: string;
    /** Fully-qualified event type name, e.g. `'show.EntrySubmitted'`. */
    readonly type: string;
    /** Wall-clock instant at which the fact occurred. */
    readonly occurredAt: Date;
    /** Ownership classification — see {@link EventScope}. */
    readonly scope: EventScope;
    /** ID of the aggregate root that produced this event. */
    readonly aggregateId: string;
    /**
     * Event-type-specific structured data.
     *
     * Concrete event types should use a named domain type for `TPayload`
     * rather than an anonymous object — e.g. `DomainEvent<EntrySubmittedData>`
     * rather than `DomainEvent<{ dogId: string }>`.
     */
    readonly payload: TPayload;
}

/**
 * Parameters for {@link createDomainEvent}.
 *
 * `eventId` and `occurredAt` are optional so that tests can supply
 * deterministic values without going through the ports.
 */
export interface CreateDomainEventParams<TPayload> {
    readonly type: string;
    readonly scope: EventScope;
    readonly aggregateId: string;
    readonly payload: TPayload;
    /** Override the generated ID (useful in tests). */
    readonly eventId?: string | undefined;
    /** Override the timestamp (useful in tests). */
    readonly occurredAt?: Date | undefined;
}

/**
 * Factory for creating a new {@link DomainEvent}.
 *
 * Using a factory instead of an object literal guarantees that `eventId`
 * and `occurredAt` are always sourced from the injected ports — making
 * every event deterministic under test and free of hidden I/O at the
 * call site.
 *
 * @param params - Static properties of the event; `eventId` and
 *   `occurredAt` may be omitted and will be resolved via `deps`.
 * @param deps   - Injected {@link Clock} and {@link IdGenerator} ports.
 */
export function createDomainEvent<TPayload>(
    params: CreateDomainEventParams<TPayload>,
    deps: { readonly clock: Clock; readonly idGenerator: IdGenerator },
): DomainEvent<TPayload> {
    return {
        eventId: params.eventId ?? deps.idGenerator.generate(),
        type: params.type,
        occurredAt: params.occurredAt ?? deps.clock.now(),
        scope: params.scope,
        aggregateId: params.aggregateId,
        payload: params.payload,
    };
}
