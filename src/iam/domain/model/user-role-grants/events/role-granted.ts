// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asEventType,
    type AggregateId,
    type ClubId,
    type DomainEventFact,
    type EventScope,
    type EventType,
} from '../../../../../Shared/index.js';
import type { DomainRole } from '../../role-grant/role-grant.js';

/**
 * The fully-qualified event-type string for {@link RoleGranted}
 * — the wire/DB form stored in the outbox `type` column and the registry key
 * the codec uses to rehydrate a stored row back into a
 * {@link RoleGranted} instance.
 */
export const ROLE_GRANTED_TYPE: EventType = asEventType('iam.RoleGranted');

/**
 * Event-type-specific structured data carried by {@link RoleGranted}.
 * `clubId` is present only for a Club-scoped role (`ShowSecretary`);
 * `undefined` for a platform-scoped role (`Judge`/`PlatformAdministrator`).
 */
export interface RoleGrantedPayload {
    readonly role: DomainRole;
    readonly clubId: ClubId | undefined;
}

/**
 * The fact that a `UserRoleGrants` root granted a role to its user.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact}
 * (ADR-0027): the `type` field is fixed to {@link ROLE_GRANTED_TYPE}; the
 * payload is the typed {@link RoleGrantedPayload}. Recorded with
 * `PlatformEventScope.of()` — `User`/role-grant data is platform-owned
 * (ADR-0005), regardless of which Club a `ShowSecretary` grant names.
 * Carries no `eventId` / `occurredAt` — those are envelope fields the unit
 * of work stamps on afterwards, from `Clock` / `EventIdGenerator` injected at
 * the composition root, never from this class or its caller (the aggregate
 * root records facts from domain data only). A private `#brand` field makes
 * the class **nominal** so a bare envelope literal is not assignable to
 * `RoleGranted`.
 *
 * Storage rehydration goes through {@link RoleGranted.rehydrate}, which the
 * context's rehydration registry wires into the outbox codec / polling
 * dispatcher.
 */
export class RoleGranted implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `RoleGranted` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = ROLE_GRANTED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: RoleGrantedPayload;

    private constructor(scope: EventScope, aggregateId: AggregateId, payload: RoleGrantedPayload) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs a {@link RoleGranted} fact — called by `UserRoleGrants`'s per-role grant methods. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: RoleGrantedPayload,
    ): RoleGranted {
        return new RoleGranted(scope, aggregateId, payload);
    }

    /**
     * Rehydrates a {@link RoleGranted} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the context's rehydration registry.
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: RoleGrantedPayload;
    }): RoleGranted {
        return new RoleGranted(fact.scope, fact.aggregateId, fact.payload);
    }
}
