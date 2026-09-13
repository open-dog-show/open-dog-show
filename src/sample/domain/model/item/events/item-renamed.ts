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
 * The fully-qualified event-type string for {@link ItemRenamed}
 * — the wire/DB form stored in the outbox `type` column and the registry key
 * the codec uses to rehydrate a stored row back into a
 * {@link ItemRenamed} instance.
 */
export const ITEM_RENAMED_TYPE: EventType = asEventType('sample.ItemRenamed');

/** Event-type-specific structured data carried by {@link ItemRenamed}. */
export interface ItemRenamedPayload {
    readonly name: string;
}

/**
 * The fact that an Item was renamed.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact}
 * (ADR-0027): the `type` field is fixed to
 * {@link ITEM_RENAMED_TYPE}; the payload is the typed
 * {@link ItemRenamedPayload}. Carries no `eventId` /
 * `occurredAt` — those are envelope fields the unit of work stamps on
 * afterwards. A private `#brand` field makes the class **nominal** so a bare
 * envelope literal is not assignable to `ItemRenamed`.
 *
 * Storage rehydration goes through {@link ItemRenamed.rehydrate},
 * which the context's rehydration registry wires into the outbox codec /
 * polling dispatcher.
 */
export class ItemRenamed implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `ItemRenamed` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = ITEM_RENAMED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: ItemRenamedPayload;

    private constructor(scope: EventScope, aggregateId: AggregateId, payload: ItemRenamedPayload) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs a {@link ItemRenamed} fact — called by `Item.rename`. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: ItemRenamedPayload,
    ): ItemRenamed {
        return new ItemRenamed(scope, aggregateId, payload);
    }

    /**
     * Rehydrates a {@link ItemRenamed} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the context's rehydration registry.
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: ItemRenamedPayload;
    }): ItemRenamed {
        return new ItemRenamed(fact.scope, fact.aggregateId, fact.payload);
    }
}
