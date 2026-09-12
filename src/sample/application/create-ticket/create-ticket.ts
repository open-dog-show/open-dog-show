// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { requireActor, type Result, type TransactionScope } from '../../../Shared/index.js';
import { asTicketId, asItemId } from '../../domain/shared/domain-ids.js';
import { Ticket, InvalidTicketNameError } from '../../domain/model/ticket/ticket.js';
import { ItemNotFoundError } from '../../domain/model/item/item.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/**
 * Inputs to {@link CreateTicketHandler.execute} that are not
 * derivable from the transaction scope or looked up from the referenced
 * Item. The acting principal comes from the
 * `TransactionScope` (via {@link requireActor}); the owning Club comes from
 * the Item being referenced (looked up by
 * `itemId`), not from the caller — a Ticket is a
 * hybrid aggregate and the acting scope need not itself be `club`
 * (ADR-0026): trusting a caller-supplied `clubId` would let a
 * Ticket be attributed to a Club that does not actually own the
 * Item.
 */
export interface CreateTicketCommand {
    /** Aggregate id of the Ticket to create. */
    readonly id: string;
    /** The Item this Ticket references; its `clubId` becomes the owner. */
    readonly itemId: string;
    readonly name: string;
}

/** Primitive view of the created Ticket (B4). */
export interface CreateTicketResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: create a Ticket — a hybrid aggregate referencing an
 * existing Item — and record the
 * `sample.TicketCreated` fact in the same
 * transaction (ADR-0014).
 *
 * The transaction boundary, repository construction, and outbox write are
 * all hidden behind the injected {@link SampleUnitOfWork}
 * port. This use case never touches domain events (ADR-0027):
 * `Ticket.create` records the fact itself, and saving the
 * Ticket through `ctx.tickets.add` pulls and
 * stamps it.
 */
export class CreateTicketHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * @throws {ScopeMismatchError} when `scope` has no acting principal (a
     *   `platform` scope) — see {@link requireActor}. A technical fault
     *   (E4/E6), not part of the `Result` channel, so it is rethrown rather
     *   than caught below.
     */
    async execute(
        command: CreateTicketCommand,
        scope: TransactionScope,
    ): Promise<Result<CreateTicketResponse, InvalidTicketNameError | ItemNotFoundError>> {
        const createdBy = requireActor(scope);
        try {
            return await this.unitOfWork.run<
                Result<CreateTicketResponse, InvalidTicketNameError | ItemNotFoundError>
            >(scope, async (ctx) => {
                const itemId = asItemId(command.itemId);
                const item = await ctx.items.findById(itemId);
                if (item === undefined) {
                    throw new ItemNotFoundError(itemId);
                }

                const ticket = Ticket.create({
                    id: asTicketId(command.id),
                    clubId: item.clubId,
                    createdBy,
                    itemId,
                    name: command.name,
                });
                await ctx.tickets.add(ticket);
                return { ok: true, value: { id: ticket.id, name: ticket.name } };
            });
        } catch (error) {
            if (error instanceof InvalidTicketNameError || error instanceof ItemNotFoundError) {
                return { ok: false, error };
            }
            throw error;
        }
    }
}
