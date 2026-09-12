// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../../../Shared/index.js';
import { asTicketId } from '../../domain/shared/domain-ids.js';
import { TicketNotFoundError } from '../../domain/model/ticket/ticket.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link RenameTicketHandler.execute}. */
export interface RenameTicketCommand {
    /** Aggregate id of the Ticket to rename. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the renamed Ticket (B4). */
export interface RenameTicketResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: rename an existing Ticket and record the
 * `sample.TicketRenamed` fact in the same
 * transaction (ADR-0014).
 *
 * Ownership is not re-derived here — `findById` only returns a row the
 * caller's RLS-scoped connection can already see, so a successful lookup
 * already proves the caller may act on it; this is the one shared shape for
 * every ownership scope (ADR-0026).
 */
export class RenameTicketHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * @throws TicketNotFoundError when `command.id` names no Ticket.
     */
    async execute(
        command: RenameTicketCommand,
        scope: TransactionScope,
    ): Promise<RenameTicketResponse> {
        return this.unitOfWork.run(scope, async (ctx) => {
            const id = asTicketId(command.id);
            const ticket = await ctx.tickets.findById(id);
            if (ticket === undefined) {
                throw new TicketNotFoundError(id);
            }
            ticket.rename(command.name);
            await ctx.tickets.update(ticket);
            return { id: ticket.id, name: ticket.name };
        });
    }
}
