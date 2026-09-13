// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DomainEventRehydrationRegistry,
    InvalidDomainEventEnvelopeError,
} from '../../../Shared/index.js';
import {
    ROLE_GRANTED_TYPE,
    RoleGranted,
} from '../../domain/model/user-role-grants/events/role-granted.js';
import {
    ROLE_REVOKED_TYPE,
    RoleRevoked,
} from '../../domain/model/user-role-grants/events/role-revoked.js';
import type { DomainRole } from '../../domain/model/role-grant/role-grant.js';
import type { ClubId } from '../../../Shared/index.js';

const DOMAIN_ROLES: readonly DomainRole[] = ['ShowSecretary', 'Judge', 'PlatformAdministrator'];

/**
 * Narrows `payload` to the `{ role, clubId }` shape shared by
 * {@link RoleGranted}/{@link RoleRevoked} — `role` must be one of the closed
 * set of {@link DomainRole}s, `clubId` a string or absent. Not reusable via
 * `assertPayloadHasStringField` (single-required-string-field only): this
 * payload has an optional second field.
 */
function assertRoleGrantPayload(
    payload: unknown,
): asserts payload is { role: DomainRole; clubId: ClubId | undefined } {
    if (typeof payload !== 'object' || payload === null) {
        throw new InvalidDomainEventEnvelopeError('payload', payload);
    }
    const { role, clubId } = payload as Record<string, unknown>;
    if (typeof role !== 'string' || !DOMAIN_ROLES.includes(role as DomainRole)) {
        throw new InvalidDomainEventEnvelopeError('payload', payload);
    }
    if (clubId !== undefined && typeof clubId !== 'string') {
        throw new InvalidDomainEventEnvelopeError('payload', payload);
    }
}

/**
 * Builds the IAM context's event-type → class rehydration registry
 * (ADR-0022 class events), mirroring
 * `buildSampleEventRehydrationRegistry` — see that function's doc for why
 * this lives in `infrastructure/messaging/` rather than `infrastructure/di/`.
 * Every event type IAM emits (`iam.RoleGranted`, `iam.RoleRevoked`) must be
 * registered here or the shared codec rejects it as unregistered.
 */
export function buildIamEventRehydrationRegistry(): DomainEventRehydrationRegistry {
    const registry = new DomainEventRehydrationRegistry();
    registry.register(ROLE_GRANTED_TYPE, ({ scope, aggregateId, payload }) => {
        assertRoleGrantPayload(payload);
        return RoleGranted.rehydrate({ scope, aggregateId, payload });
    });
    registry.register(ROLE_REVOKED_TYPE, ({ scope, aggregateId, payload }) => {
        assertRoleGrantPayload(payload);
        return RoleRevoked.rehydrate({ scope, aggregateId, payload });
    });
    return registry;
}
