// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asAggregateId, asClubId, PlatformEventScope } from '../../../../../../src/Shared/index.js';
import {
    ROLE_GRANTED_TYPE,
    RoleGranted,
} from '../../../../../../src/iam/domain/model/user-role-grants/events/role-granted.js';

const AGGREGATE_ID = asAggregateId('user-alice');
const CLUB_A = asClubId('club-a');

describe('RoleGranted', () => {
    it('create constructs a fact with the fixed type and given scope/payload', () => {
        const event = RoleGranted.create(AGGREGATE_ID, PlatformEventScope.of(), {
            role: 'ShowSecretary',
            clubId: CLUB_A,
        });

        expect(event.type).toBe(ROLE_GRANTED_TYPE);
        expect(event.aggregateId).toBe(AGGREGATE_ID);
        expect(event.scope).toEqual(PlatformEventScope.of());
        expect(event.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
    });

    it('supports a platform-scoped role with no clubId', () => {
        const event = RoleGranted.create(AGGREGATE_ID, PlatformEventScope.of(), {
            role: 'Judge',
            clubId: undefined,
        });

        expect(event.payload).toEqual({ role: 'Judge', clubId: undefined });
    });

    it('rehydrate reconstructs the same fact shape from stored fields', () => {
        const event = RoleGranted.rehydrate({
            scope: PlatformEventScope.of(),
            aggregateId: AGGREGATE_ID,
            payload: { role: 'ShowSecretary', clubId: CLUB_A },
        });

        expect(event).toBeInstanceOf(RoleGranted);
        expect(event.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
    });
});
