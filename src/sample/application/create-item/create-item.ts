// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { requireActor, requireClubScope, type TransactionScope } from '../../../Shared/index.js';
import { asItemId } from '../../domain/shared/domain-ids.js';
import { Item } from '../../domain/model/item/item.js';
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
 * throws `ScopeMismatchError` for any other scope kind.
 */
export class CreateItemHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * @throws {ScopeMismatchError} when `scope` is not a `club` scope.
     */
    async execute(
        command: CreateItemCommand,
        scope: TransactionScope,
    ): Promise<CreateItemResponse> {
        const clubId = requireClubScope(scope);
        const createdBy = requireActor(scope);
        return this.unitOfWork.run(scope, async (ctx) => {
            const item = Item.create({
                id: asItemId(command.id),
                clubId,
                createdBy,
                name: command.name,
            });
            await ctx.items.add(item);
            return { id: item.id, name: item.name };
        });
    }
}
