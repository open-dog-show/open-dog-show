// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Clock, EventIdGenerator } from './domain-ports.js';
import type { EventId, EventType, AggregateId } from './domain-ids.js';

/**
 * Ownership classification of a past fact.
 *
 * Declares which data-ownership scope produced the event:
 * - `'club'`      — the fact belongs to a kennel-club Club.
 * - `'exhibitor'` — the fact belongs to an individual exhibitor.
 * - `'platform'`  — the fact is platform-wide and has no single owner.
 *
 * This is **not** the same as `TransactionScope`, which describes the
 * database-transaction context.  An event's `EventScope` is immutable once
 * recorded; `TransactionScope` is ephemeral and lives only for the duration
 * of one unit-of-work.
 *
 * Modelled as a class-based **variant value object** (ADR-0023): a discriminated
 * union of data-less value-object classes, each carrying only a `kind` tag and
 * constructed solely through its `of` factory (V2/V3). The wire/DB form is the
 * `kind` string, rehydrated by {@link asEventScope} at the boundary.
 */
export class ClubEventScope {
    readonly kind = 'club' as const;

    private constructor() {}

    static of(): ClubEventScope {
        return new ClubEventScope();
    }

    equals(other: ClubEventScope): boolean {
        return this.kind === other.kind;
    }
}

export class ExhibitorEventScope {
    readonly kind = 'exhibitor' as const;

    private constructor() {}

    static of(): ExhibitorEventScope {
        return new ExhibitorEventScope();
    }

    equals(other: ExhibitorEventScope): boolean {
        return this.kind === other.kind;
    }
}

export class PlatformEventScope {
    readonly kind = 'platform' as const;

    private constructor() {}

    static of(): PlatformEventScope {
        return new PlatformEventScope();
    }

    equals(other: PlatformEventScope): boolean {
        return this.kind === other.kind;
    }
}

export type EventScope = ClubEventScope | ExhibitorEventScope | PlatformEventScope;

/**
 * Value equality for {@link EventScope} — every variant is data-less, so two
 * scopes are equal iff their `kind` tags match (V3). Narrows on `kind` and
 * delegates to the variant's {@link EventScope#equals} for shape parity with
 * the other variant value objects.
 */
export function eventScopesEqual(a: EventScope, b: EventScope): boolean {
    switch (a.kind) {
        case 'club':
            return b.kind === 'club' && a.equals(b);
        case 'exhibitor':
            return b.kind === 'exhibitor' && a.equals(b);
        case 'platform':
            return b.kind === 'platform' && a.equals(b);
    }
}

/**
 * Casts a raw wire/DB string to an {@link EventScope}, **validating** it is one
 * of the three known scopes. Mirrors `asEventType`: a corrupt `scope` from a
 * database row or JSON must be rejected at the boundary rather than propagated
 * as a typed event.
 *
 * @throws {TypeError} when `value` is not a known EventScope.
 */
export function asEventScope(value: string): EventScope {
    switch (value) {
        case 'club':
            return ClubEventScope.of();
        case 'exhibitor':
            return ExhibitorEventScope.of();
        case 'platform':
            return PlatformEventScope.of();
        default:
            throw new TypeError(
                `Invalid EventScope '${value}': expected 'club', 'exhibitor', or 'platform'.`,
            );
    }
}

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
    readonly eventId: EventId;
    /** Fully-qualified event type name, e.g. `'entries.EntrySubmitted'`. */
    readonly type: EventType;
    /** Wall-clock instant at which the fact occurred. */
    readonly occurredAt: Date;
    /** Ownership classification — see {@link EventScope}. */
    readonly scope: EventScope;
    /**
     * ID of the aggregate root that produced this event.
     *
     * Context-neutral branded id: the kernel cannot know which
     * context-specific brand an aggregate id carries, so a generic
     * {@link AggregateId} is used here.  Contexts may narrow further at their
     * own boundary.
     */
    readonly aggregateId: AggregateId;
    /** Event-type-specific structured data. */
    readonly payload: TPayload;
}

/**
 * Parameters for {@link createDomainEvent}.
 *
 * `eventId` and `occurredAt` are optional so that tests can supply
 * deterministic values without going through the ports.
 */
export interface CreateDomainEventParams<TPayload> {
    readonly type: EventType;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: TPayload;
    /** Override the generated ID (useful in tests). */
    readonly eventId?: EventId | undefined;
    /** Override the timestamp (useful in tests). */
    readonly occurredAt?: Date | undefined;
}

/**
 * Factory for creating a new {@link DomainEvent}.
 *
 * Using a factory instead of an object literal defaults `eventId` and
 * `occurredAt` to the injected ports — making every event deterministic
 * under test and free of hidden I/O at the call site — unless a caller
 * overrides them via `params.eventId` / `params.occurredAt` (e.g. tests
 * supplying deterministic values). `DomainEvent` is a structural interface,
 * so a literal-constructed event bypasses these defaults; the factory is the
 * recommended construction path.
 *
 * @param params - Static properties of the event; `eventId` and
 *   `occurredAt` may be omitted and will be resolved via `deps`.
 * @param deps   - Injected {@link Clock} and {@link EventIdGenerator} ports.
 */
export function createDomainEvent<TPayload>(
    params: CreateDomainEventParams<TPayload>,
    deps: { readonly clock: Clock; readonly eventIdGenerator: EventIdGenerator },
): DomainEvent<TPayload> {
    return {
        eventId: params.eventId ?? deps.eventIdGenerator.generate(),
        type: params.type,
        occurredAt: params.occurredAt ?? deps.clock.now(),
        scope: params.scope,
        aggregateId: params.aggregateId,
        payload: params.payload,
    };
}
