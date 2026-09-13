// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { asClubId, asPrincipalId } from '../../../../Shared/index.js';
import { asTicketId, asItemId, type TicketId } from '../../../domain/shared/domain-ids.js';
import { ticketsTable } from './schema.js';
import { Ticket } from '../../../domain/model/ticket/ticket.js';
import type { TicketRepository } from '../../../domain/model/ticket/ticket-repository.js';
import { TicketPersistenceFailed } from './ticket-persistence-failed.js';

export class DrizzleTicketRepository implements TicketRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findById(id: TicketId): Promise<Ticket | undefined> {
        try {
            const [row] = await this.drizzle
                .select()
                .from(ticketsTable)
                .where(eq(ticketsTable.id, id));
            return row === undefined
                ? undefined
                : Ticket.rehydrate({
                      id: asTicketId(row.id),
                      clubId: asClubId(row.clubId),
                      createdBy: asPrincipalId(row.principalId),
                      itemId: asItemId(row.itemId),
                      name: row.name,
                  });
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new TicketPersistenceFailed('reading a ticket', cause);
        }
    }

    async add(ticket: Ticket): Promise<void> {
        try {
            await this.drizzle.insert(ticketsTable).values({
                id: ticket.id,
                clubId: ticket.clubId,
                principalId: ticket.createdBy,
                itemId: ticket.itemId,
                name: ticket.name,
            });
        } catch (cause) {
            throw new TicketPersistenceFailed('adding a ticket', cause);
        }
    }

    async update(ticket: Ticket): Promise<void> {
        try {
            await this.drizzle
                .update(ticketsTable)
                .set({ name: ticket.name })
                .where(eq(ticketsTable.id, ticket.id));
        } catch (cause) {
            throw new TicketPersistenceFailed('updating a ticket', cause);
        }
    }
}
