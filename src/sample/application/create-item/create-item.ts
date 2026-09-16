// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    requireActor,
    requireClubScope,
    type Result,
    type TransactionScope,
} from '../../../Shared/index.js';
import { asItemId } from '../../domain/shared/domain-ids.js';
import { Item, InvalidItemNameError } from '../../domain/model/item/item.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link CreateItemHandler.execute} that are not derivable from the transaction scope. */
export interface CreateItemCommand {
    /** Aggregate id of the Item to create. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the created Item (B4). */
export interface CreateItemResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: create an Item — a club-scoped aggregate — and
 * record the `sample.ItemCreated` fact in
 * the same transaction (ADR-0014).
 *
 * `scope` must itself be a `club` scope (ADR-0026) — {@link requireClubScope}
 * throws `ScopeMismatchError` for any other scope kind; that is a technical
 * fault (E4/E6), not part of the `Result` channel, so it is rethrown rather
 * than caught below.
 */
export class CreateItemHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * @throws {ScopeMismatchError} when `scope` is not a `club` scope.
     */
    async execute(
        command: CreateItemCommand,
        scope: TransactionScope,
    ): Promise<Result<CreateItemResponse, InvalidItemNameError>> {
        const clubId = requireClubScope(scope);
        const createdBy = requireActor(scope);
        // This construct-then-save shape repeats near-identically across the
        // 4 scope variants of every create-*.ts.hbs template — tracked in
        // #216 (four-scope template duplication), not fixed here.
        // create-hybrid.ts.hbs is the one variant that keeps validation
        // inside the transaction instead — see its createInTransaction doc
        // comment for why.
        let item: Item;
        try {
            item = Item.create({
                id: asItemId(command.id),
                clubId,
                createdBy,
                name: command.name,
            });
        } catch (error) {
            if (error instanceof InvalidItemNameError) {
                return { ok: false, error };
            }
            throw error;
        }
        await this.unitOfWork.run(scope, async (ctx) => {
            await ctx.items.add(item);
        });
        return { ok: true, value: { id: item.id, name: item.name } };
    }
}
