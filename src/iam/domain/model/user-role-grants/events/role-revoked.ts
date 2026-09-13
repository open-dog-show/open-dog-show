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
 * The fully-qualified event-type string for {@link RoleRevoked}
 * — the wire/DB form stored in the outbox `type` column and the registry key
 * the codec uses to rehydrate a stored row back into a
 * {@link RoleRevoked} instance.
 */
export const ROLE_REVOKED_TYPE: EventType = asEventType('iam.RoleRevoked');

/**
 * Event-type-specific structured data carried by {@link RoleRevoked}.
 * `clubId` is present only for a Club-scoped role (`ShowSecretary`);
 * `undefined` for a platform-scoped role (`Judge`/`PlatformAdministrator`).
 */
export interface RoleRevokedPayload {
    readonly role: DomainRole;
    readonly clubId: ClubId | undefined;
}

/**
 * The fact that a `UserRoleGrants` root revoked a role from its user.
 *
 * Modelled as a **class event** implementing {@link DomainEventFact}
 * (ADR-0027): the `type` field is fixed to {@link ROLE_REVOKED_TYPE}; the
 * payload is the typed {@link RoleRevokedPayload}. Recorded with
 * `EventScope.platform()` — `User`/role-grant data is platform-owned
 * (ADR-0005), regardless of which Club a `ShowSecretary` grant named.
 * Carries no `eventId` / `occurredAt` — those are envelope fields the unit
 * of work stamps on afterwards. A private `#brand` field makes the class
 * **nominal** so a bare envelope literal is not assignable to `RoleRevoked`.
 *
 * Storage rehydration goes through {@link RoleRevoked.rehydrate}, which the
 * context's rehydration registry wires into the outbox codec / polling
 * dispatcher.
 */
export class RoleRevoked implements DomainEventFact {
    // Nominal brand: a bare envelope literal lacks this private field, so it is
    // not assignable to `RoleRevoked` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly type = ROLE_REVOKED_TYPE;
    readonly scope: EventScope;
    readonly aggregateId: AggregateId;
    readonly payload: RoleRevokedPayload;

    private constructor(scope: EventScope, aggregateId: AggregateId, payload: RoleRevokedPayload) {
        this.scope = scope;
        this.aggregateId = aggregateId;
        this.payload = payload;
    }

    /** Constructs a {@link RoleRevoked} fact — called by `UserRoleGrants.prototype.revoke`. */
    static create(
        aggregateId: AggregateId,
        scope: EventScope,
        payload: RoleRevokedPayload,
    ): RoleRevoked {
        return new RoleRevoked(scope, aggregateId, payload);
    }

    /**
     * Rehydrates a {@link RoleRevoked} fact from a stored row's
     * already-validated fields — the path the outbox codec / polling
     * dispatcher use via the context's rehydration registry.
     */
    static rehydrate(fact: {
        readonly scope: EventScope;
        readonly aggregateId: AggregateId;
        readonly payload: RoleRevokedPayload;
    }): RoleRevoked {
        return new RoleRevoked(fact.scope, fact.aggregateId, fact.payload);
    }
}
