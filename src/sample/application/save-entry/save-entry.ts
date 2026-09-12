// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { requireActor, type TransactionScope } from '../../../Shared/index.js';
import { asEntryId, asShowId } from '../../domain/shared/domain-ids.js';
import { Entry } from '../../domain/model/entry/entry.js';
import { ShowNotFoundError } from '../../domain/model/show/show.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/**
 * Inputs to {@link SaveEntryUseCase.execute} that are not derivable from the
 * transaction scope or looked up from the Show. The acting principal comes
 * from the `TransactionScope` (via {@link requireActor}); the owning Club
 * comes from the Show being entered (looked up by `showId`), not from the
 * caller — an Entry is a hybrid aggregate and the acting scope need not
 * itself be `club` (ADR-0026): trusting a caller-supplied `clubId` would let
 * an Entry be attributed to a Club that does not actually own the Show.
 */
export interface SaveEntryInput {
    /** Aggregate id of the Entry to save. */
    readonly id: string;
    /** The Show the Entry is submitted to; its `clubId` becomes the Entry's owner. */
    readonly showId: string;
    /** The dog's call name. */
    readonly dogName: string;
}

/**
 * Use case: submit an Entry and record the `sample.EntrySubmitted` fact in the
 * same transaction (ADR-0014).
 *
 * The transaction boundary, repository construction, and outbox write are all
 * hidden behind the injected {@link SampleUnitOfWork} port. This use case
 * never touches domain events (ADR-0027): `Entry.submit` records the fact
 * itself, and saving the Entry through `ctx.entries` pulls and stamps it.
 */
export class SaveEntryUseCase {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    /**
     * Save the Entry described by `input` under `scope` and emit the
     * `sample.EntrySubmitted` domain event in the same transaction.
     *
     * @throws {ScopeMismatchError} when `scope` has no acting principal (a
     *   `platform` scope) — see {@link requireActor}.
     * @throws {ShowNotFoundError} when `input.showId` names no Show.
     */
    async execute(input: SaveEntryInput, scope: TransactionScope): Promise<void> {
        const createdBy = requireActor(scope);
        await this.unitOfWork.run(scope, async (ctx) => {
            const showId = asShowId(input.showId);
            const show = await ctx.shows.findById(showId);
            if (show === undefined) {
                throw new ShowNotFoundError(showId);
            }

            const entry = Entry.submit({
                id: asEntryId(input.id),
                clubId: show.clubId,
                createdBy,
                showId,
                dogName: input.dogName,
            });
            await ctx.entries.save(entry);
        });
    }
}
