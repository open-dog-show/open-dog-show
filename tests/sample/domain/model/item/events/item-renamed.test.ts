// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asAggregateId, PlatformEventScope } from '../../../../../../src/Shared/index.js';
import {
    ITEM_RENAMED_TYPE,
    ItemRenamed,
} from '../../../../../../src/sample/domain/model/item/events/item-renamed.js';

const AGGREGATE_ID = asAggregateId('00000000-0000-4000-8000-000000000021');

describe('ItemRenamed', () => {
    it('create constructs a fact with the fixed type and given scope/payload', () => {
        const event = ItemRenamed.create(AGGREGATE_ID, PlatformEventScope.of(), {
            name: 'A new name',
        });

        expect(event.type).toBe(ITEM_RENAMED_TYPE);
        expect(event.aggregateId).toBe(AGGREGATE_ID);
        expect(event.scope).toEqual(PlatformEventScope.of());
        expect(event.payload).toEqual({ name: 'A new name' });
    });

    it('rehydrate reconstructs the same fact shape from stored fields', () => {
        const event = ItemRenamed.rehydrate({
            scope: PlatformEventScope.of(),
            aggregateId: AGGREGATE_ID,
            payload: { name: 'A new name' },
        });

        expect(event).toBeInstanceOf(ItemRenamed);
        expect(event.payload).toEqual({ name: 'A new name' });
    });
});
