// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, asPrincipalId, ClubEventScope } from '../../../../../src/Shared/index.js';
import { Item, InvalidItemNameError } from '../../../../../src/sample/domain/model/item/item.js';
import { asItemId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const ITEM_ID = asItemId('00000000-0000-4000-8000-000000000021');

describe('Item', () => {
    it('create records ItemCreated scoped to the owning Club', () => {
        const item = Item.create({
            id: ITEM_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Original name',
        });

        const [event] = item.pullEvents();
        expect(event?.type).toBe('sample.ItemCreated');
        expect(event?.scope).toEqual(ClubEventScope.of(CLUB_ID));
        expect(event?.payload).toEqual({ name: 'Original name' });
        expect(item.name).toBe('Original name');
    });

    it('create rejects a blank name', () => {
        expect(() =>
            Item.create({
                id: ITEM_ID,
                clubId: CLUB_ID,
                createdBy: PRINCIPAL_ID,
                name: '   ',
            }),
        ).toThrow(InvalidItemNameError);
    });

    it('rehydrate does not record an event', () => {
        const item = Item.rehydrate({
            id: ITEM_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Restored name',
        });

        expect(item.pullEvents()).toEqual([]);
        expect(item.name).toBe('Restored name');
    });

    it('rename records ItemRenamed and updates the name', () => {
        const item = Item.rehydrate({
            id: ITEM_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Old name',
        });

        item.rename('New name');

        const [event] = item.pullEvents();
        expect(event?.type).toBe('sample.ItemRenamed');
        expect(event?.scope).toEqual(ClubEventScope.of(CLUB_ID));
        expect(event?.payload).toEqual({ name: 'New name' });
        expect(item.name).toBe('New name');
    });

    it('rename rejects a blank name', () => {
        const item = Item.rehydrate({
            id: ITEM_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            name: 'Old name',
        });

        expect(() => item.rename('')).toThrow(InvalidItemNameError);
    });
});
