// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asAggregateId,
    asEventType,
    createDomainEvent,
    type Clock,
    type EventIdGenerator,
    type TransactionScope,
} from '@ods/kernel';
import type { Entry } from '../domain/entry.js';
import type { SampleUnitOfWork } from '../domain/unit-of-work.js';

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
 * Construct the {@link Entry} aggregate from the use-case input and the
 * transaction scope.
 *
 * An Entry is Club-owned, so only a `club` scope (which carries both the
 * owning `ClubId` and the acting `PrincipalId`) is accepted; an `exhibitor`
 * or `platform` scope has no Club to attribute the Entry to.
 */
function toEntry(input: SaveEntryInput, scope: TransactionScope): Entry {
    if (scope.kind !== 'club') {
        throw new Error(
            `SaveEntryUseCase requires a club-scoped transaction, received '${scope.kind}'`,
        );
    }
    return {
        id: input.id,
        clubId: scope.clubId,
        principalId: scope.principalId,
        showId: input.showId,
        dogName: input.dogName,
    };
}

/**
 * Use case: submit (upsert) an Entry and record the `sample.EntrySubmitted`
 * fact in the same transaction (ADR-0014).
 *
 * The transaction boundary, repository construction, and outbox write are all
 * hidden behind the injected {@link SampleUnitOfWork} port, so this class
 * depends only on domain types and `@ods/kernel` — it is trivially unit-testable
 * with a fake unit of work and no Docker.
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
            const entry = toEntry(input, scope);
            await ctx.entries.save(entry);
            ctx.appendEvents(
                createDomainEvent(
                    {
                        type: asEventType('sample.EntrySubmitted'),
                        scope: 'club',
                        aggregateId: asAggregateId(entry.id),
                        payload: { dogName: entry.dogName },
                    },
                    { clock: this.clock, eventIdGenerator: this.eventIdGenerator },
                ),
            );
        });
    }
}
