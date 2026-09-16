// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    asAggregateId,
    asClubId,
    InvalidDomainEventEnvelopeError,
    PlatformEventScope,
} from '../../../../src/Shared/index.js';
import {
    ROLE_GRANTED_TYPE,
    RoleGranted,
} from '../../../../src/iam/domain/model/user-role-grants/events/role-granted.js';
import {
    ROLE_REVOKED_TYPE,
    RoleRevoked,
} from '../../../../src/iam/domain/model/user-role-grants/events/role-revoked.js';
import { buildIamEventRehydrationRegistry } from '../../../../src/iam/infrastructure/messaging/iam-event-registry.js';
import type {
    DomainEventRehydrationRegistry,
    DomainEventRehydrator,
} from '../../../../src/Shared/infrastructure/messaging/domain-event-rehydration-registry.js';
import type { EventType } from '../../../../src/Shared/index.js';

const AGGREGATE_ID = asAggregateId('user-alice');
const CLUB_A = asClubId('club-a');
const SCOPE = PlatformEventScope.of();

function requireRehydrator(
    registry: DomainEventRehydrationRegistry,
    type: EventType,
): DomainEventRehydrator {
    const rehydrator = registry.rehydratorFor(type);
    if (rehydrator === undefined) {
        throw new Error(`No rehydrator registered for '${type}'`);
    }
    return rehydrator;
}

describe('buildIamEventRehydrationRegistry', () => {
    it('registers a rehydrator for iam.RoleGranted that reconstructs a RoleGranted instance', () => {
        const registry = buildIamEventRehydrationRegistry();
        const rehydrator = requireRehydrator(registry, ROLE_GRANTED_TYPE);

        const fact = rehydrator({
            type: ROLE_GRANTED_TYPE,
            scope: SCOPE,
            aggregateId: AGGREGATE_ID,
            payload: { role: 'ShowSecretary', clubId: CLUB_A },
        });

        expect(fact).toBeInstanceOf(RoleGranted);
        expect(fact.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
    });

    it('registers a rehydrator for iam.RoleRevoked that reconstructs a RoleRevoked instance', () => {
        const registry = buildIamEventRehydrationRegistry();
        const rehydrator = requireRehydrator(registry, ROLE_REVOKED_TYPE);

        const fact = rehydrator({
            type: ROLE_REVOKED_TYPE,
            scope: SCOPE,
            aggregateId: AGGREGATE_ID,
            payload: { role: 'Judge', clubId: undefined },
        });

        expect(fact).toBeInstanceOf(RoleRevoked);
        expect(fact.payload).toEqual({ role: 'Judge', clubId: undefined });
    });

    it('accepts a payload with no clubId key at all (platform-scoped role, JSON round-trip)', () => {
        const registry = buildIamEventRehydrationRegistry();
        const rehydrator = requireRehydrator(registry, ROLE_GRANTED_TYPE);

        const fact = rehydrator({
            type: ROLE_GRANTED_TYPE,
            scope: SCOPE,
            aggregateId: AGGREGATE_ID,
            payload: { role: 'PlatformAdministrator' },
        });

        expect(fact.payload).toEqual({ role: 'PlatformAdministrator' });
    });

    it('rejects a payload with an unknown role', () => {
        const registry = buildIamEventRehydrationRegistry();
        const rehydrator = requireRehydrator(registry, ROLE_GRANTED_TYPE);

        expect(() =>
            rehydrator({
                type: ROLE_GRANTED_TYPE,
                scope: SCOPE,
                aggregateId: AGGREGATE_ID,
                payload: { role: 'Superuser' },
            }),
        ).toThrow(InvalidDomainEventEnvelopeError);
    });

    it('rejects a payload whose clubId is not a string', () => {
        const registry = buildIamEventRehydrationRegistry();
        const rehydrator = requireRehydrator(registry, ROLE_GRANTED_TYPE);

        expect(() =>
            rehydrator({
                type: ROLE_GRANTED_TYPE,
                scope: SCOPE,
                aggregateId: AGGREGATE_ID,
                payload: { role: 'ShowSecretary', clubId: 42 },
            }),
        ).toThrow(InvalidDomainEventEnvelopeError);
    });

    it('rejects a null or non-object payload', () => {
        const registry = buildIamEventRehydrationRegistry();
        const rehydrator = requireRehydrator(registry, ROLE_GRANTED_TYPE);

        expect(() =>
            rehydrator({
                type: ROLE_GRANTED_TYPE,
                scope: SCOPE,
                aggregateId: AGGREGATE_ID,
                payload: null,
            }),
        ).toThrow(InvalidDomainEventEnvelopeError);
    });
});
