// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asAggregateId, asClubId, PlatformEventScope } from '../../../../../../src/Shared/index.js';
import {
    ROLE_REVOKED_TYPE,
    RoleRevoked,
} from '../../../../../../src/iam/domain/model/user-role-grants/events/role-revoked.js';

const AGGREGATE_ID = asAggregateId('user-alice');
const CLUB_A = asClubId('club-a');

describe('RoleRevoked', () => {
    it('create constructs a fact with the fixed type and given scope/payload', () => {
        const event = RoleRevoked.create(AGGREGATE_ID, PlatformEventScope.of(), {
            role: 'ShowSecretary',
            clubId: CLUB_A,
        });

        expect(event.type).toBe(ROLE_REVOKED_TYPE);
        expect(event.aggregateId).toBe(AGGREGATE_ID);
        expect(event.scope).toEqual(PlatformEventScope.of());
        expect(event.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
    });

    it('supports a platform-scoped role with no clubId', () => {
        const event = RoleRevoked.create(AGGREGATE_ID, PlatformEventScope.of(), {
            role: 'PlatformAdministrator',
            clubId: undefined,
        });

        expect(event.payload).toEqual({ role: 'PlatformAdministrator', clubId: undefined });
    });

    it('rehydrate reconstructs the same fact shape from stored fields', () => {
        const event = RoleRevoked.rehydrate({
            scope: PlatformEventScope.of(),
            aggregateId: AGGREGATE_ID,
            payload: { role: 'ShowSecretary', clubId: CLUB_A },
        });

        expect(event).toBeInstanceOf(RoleRevoked);
        expect(event.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
    });
});
