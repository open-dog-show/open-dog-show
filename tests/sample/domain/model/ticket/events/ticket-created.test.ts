// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asAggregateId, PlatformEventScope } from '../../../../../../src/Shared/index.js';
import {
    TICKET_CREATED_TYPE,
    TicketCreated,
} from '../../../../../../src/sample/domain/model/ticket/events/ticket-created.js';

const AGGREGATE_ID = asAggregateId('00000000-0000-4000-8000-000000000021');

describe('TicketCreated', () => {
    it('create constructs a fact with the fixed type and given scope/payload', () => {
        const event = TicketCreated.create(AGGREGATE_ID, PlatformEventScope.of(), {
            name: 'A name',
        });

        expect(event.type).toBe(TICKET_CREATED_TYPE);
        expect(event.aggregateId).toBe(AGGREGATE_ID);
        expect(event.scope).toEqual(PlatformEventScope.of());
        expect(event.payload).toEqual({ name: 'A name' });
    });

    it('rehydrate reconstructs the same fact shape from stored fields', () => {
        const event = TicketCreated.rehydrate({
            scope: PlatformEventScope.of(),
            aggregateId: AGGREGATE_ID,
            payload: { name: 'A name' },
        });

        expect(event).toBeInstanceOf(TicketCreated);
        expect(event.payload).toEqual({ name: 'A name' });
    });
});
