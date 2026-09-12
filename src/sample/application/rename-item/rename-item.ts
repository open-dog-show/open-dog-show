// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../../../Shared/index.js';
import { asItemId } from '../../domain/shared/domain-ids.js';
import { ItemNotFoundError } from '../../domain/model/item/item.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link RenameItemHandler.execute}. */
export interface RenameItemCommand {
    /** Aggregate id of the Item to rename. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the renamed Item (B4). */
export interface RenameItemResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: rename an existing Item and record the
 * `sample.ItemRenamed` fact in the same
 * transaction (ADR-0014).
 *
 * Ownership is not re-derived here — `findById` only returns a row the
 * caller's RLS-scoped connection can already see, so a successful lookup
 * already proves the caller may act on it; this is the one shared shape for
 * every ownership scope (ADR-0026).
 */
export class RenameItemHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * @throws ItemNotFoundError when `command.id` names no Item.
     */
    async execute(
        command: RenameItemCommand,
        scope: TransactionScope,
    ): Promise<RenameItemResponse> {
        return this.unitOfWork.run(scope, async (ctx) => {
            const id = asItemId(command.id);
            const item = await ctx.items.findById(id);
            if (item === undefined) {
                throw new ItemNotFoundError(id);
            }
            item.rename(command.name);
            await ctx.items.update(item);
            return { id: item.id, name: item.name };
        });
    }
}
