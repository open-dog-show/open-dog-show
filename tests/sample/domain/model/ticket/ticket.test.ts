// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, asPrincipalId, ClubEventScope } from '../../../../../src/Shared/index.js';
import {
    Ticket,
    InvalidTicketNameError,
} from '../../../../../src/sample/domain/model/ticket/ticket.js';
import { asTicketId, asItemId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const TICKET_ID = asTicketId('00000000-0000-4000-8000-000000000021');
const ITEM_ID = asItemId('00000000-0000-4000-8000-000000000031');

describe('Ticket', () => {
    it('create records TicketCreated scoped to the owning Club, regardless of the actor', () => {
        const ticket = Ticket.create({
            id: TICKET_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            itemId: ITEM_ID,
            name: 'Original name',
        });

        const [event] = ticket.pullEvents();
        expect(event?.type).toBe('sample.TicketCreated');
        expect(event?.scope).toEqual(ClubEventScope.of(CLUB_ID));
        expect(event?.payload).toEqual({ name: 'Original name' });
        expect(ticket.name).toBe('Original name');
        expect(ticket.itemId).toBe(ITEM_ID);
    });

    it('create rejects a blank name', () => {
        expect(() =>
            Ticket.create({
                id: TICKET_ID,
                clubId: CLUB_ID,
                createdBy: PRINCIPAL_ID,
                itemId: ITEM_ID,
                name: '   ',
            }),
        ).toThrow(InvalidTicketNameError);
    });

    it('rehydrate does not record an event', () => {
        const ticket = Ticket.rehydrate({
            id: TICKET_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            itemId: ITEM_ID,
            name: 'Restored name',
        });

        expect(ticket.pullEvents()).toEqual([]);
        expect(ticket.name).toBe('Restored name');
    });

    it('rename records TicketRenamed scoped to the owning Club', () => {
        const ticket = Ticket.rehydrate({
            id: TICKET_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            itemId: ITEM_ID,
            name: 'Old name',
        });

        ticket.rename('New name');

        const [event] = ticket.pullEvents();
        expect(event?.type).toBe('sample.TicketRenamed');
        expect(event?.scope).toEqual(ClubEventScope.of(CLUB_ID));
        expect(event?.payload).toEqual({ name: 'New name' });
        expect(ticket.name).toBe('New name');
    });

    it('rename rejects a blank name', () => {
        const ticket = Ticket.rehydrate({
            id: TICKET_ID,
            clubId: CLUB_ID,
            createdBy: PRINCIPAL_ID,
            itemId: ITEM_ID,
            name: 'Old name',
        });

        expect(() => ticket.rename('')).toThrow(InvalidTicketNameError);
    });
});
