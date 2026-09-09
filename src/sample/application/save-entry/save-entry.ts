// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asAggregateId,
    asEventType,
    ClubEventScope,
    createDomainEvent,
    type Clock,
    type EventIdGenerator,
    type TransactionScope,
} from '../../../Shared/index.js';
import { asEntryId, asShowId } from '../../domain/shared/domain-ids.js';
import { createEntry } from '../../domain/model/entry/entry.js';
// Re-exported so existing callers (`from './save-entry.js'`) still see the
// error; the canonical definition lives with the `createEntry` factory in the
// Entry aggregate.
export { InvalidTransactionScopeError } from '../../domain/model/entry/entry.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/**
 * Inputs to {@link SaveEntryUseCase.execute} that are not derivable from the
 * transaction scope. The owning Club and the acting principal come from the
 * `TransactionScope`; everything the caller controls lives here.
 */
export interface SaveEntryInput {
    /** Aggregate id of the Entry to save (upserts on conflict). */
    readonly id: string;
    /** The Show the Entry is submitted to. */
    readonly showId: string;
    /** The dog's call name. */
    readonly dogName: string;
}

/**
 * Use case: submit (upsert) an Entry and record the `sample.EntrySubmitted`
 * fact in the same transaction (ADR-0014).
 *
 * The transaction boundary, repository construction, and outbox write are all
 * hidden behind the injected {@link SampleUnitOfWork} port, so this class
 * depends only on domain types and the shared kernel — it is trivially
 * unit-testable with a fake unit of work and no Docker.
 */
export class SaveEntryUseCase {
    /**
     * @param unitOfWork - The per-context unit-of-work port (transaction + repos + outbox).
     * @param clock - Injected wall-clock port for deterministic event timestamps.
     * @param eventIdGenerator - Injected id-generator port for deterministic event ids.
     */
    constructor(
        private readonly unitOfWork: SampleUnitOfWork,
        private readonly clock: Clock,
        private readonly eventIdGenerator: EventIdGenerator,
    ) {}

    /**
     * Save the Entry described by `input` under `scope` and emit the
     * `sample.EntrySubmitted` domain event in the same transaction.
     */
    async execute(input: SaveEntryInput, scope: TransactionScope): Promise<void> {
        await this.unitOfWork.run(scope, async (ctx) => {
            const entry = createEntry(scope, {
                id: asEntryId(input.id),
                showId: asShowId(input.showId),
                dogName: input.dogName,
            });
            await ctx.entries.save(entry);
            ctx.appendEvents(
                createDomainEvent(
                    {
                        type: asEventType('sample.EntrySubmitted'),
                        scope: ClubEventScope.of(),
                        aggregateId: asAggregateId(entry.id),
                        payload: { dogName: entry.dogName },
                    },
                    { clock: this.clock, eventIdGenerator: this.eventIdGenerator },
                ),
            );
        });
    }
}
