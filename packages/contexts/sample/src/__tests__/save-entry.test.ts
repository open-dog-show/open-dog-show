// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asAggregateId,
    asClubId,
    asPrincipalId,
    FakeClock,
    FakeEventIdGenerator,
    type DomainEvent,
    type TransactionScope,
} from '@ods/kernel';
import type { Entry, EntryRepository } from '../domain/entry.js';
import type { Show, ShowRepository } from '../domain/show.js';
import type { SampleUnitOfWork, SampleUnitOfWorkContext } from '../domain/unit-of-work.js';
import { SaveEntryUseCase, type SaveEntryInput } from '../application/save-entry.js';

// Fixed deterministic IDs.
const CLUB_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000011';
const SHOW_ID = '00000000-0000-4000-8000-000000000021';
const ENTRY_ID = '00000000-0000-4000-8000-000000000031';

const clubScope: TransactionScope = {
    kind: 'club',
    clubId: asClubId(CLUB_ID),
    principalId: asPrincipalId(USER_ID),
};

/**
 * In-memory {@link SampleUnitOfWork} for unit-testing the use case without
 * Docker. Captures saved entries and appended events so assertions can
 * observe the effect of a use-case call through the public seam.
 */
class FakeSampleUnitOfWork implements SampleUnitOfWork {
    readonly savedEntries: Entry[] = [];
    readonly appendedEvents: DomainEvent<unknown>[] = [];

    readonly entries: EntryRepository = {
        findAll: async () => [...this.savedEntries],
        save: async (entry: Entry) => {
            this.savedEntries.push(entry);
        },
    };
    readonly shows: ShowRepository = {
        findAll: async () => [] as Show[],
        save: async () => {},
    };

    async run<T>(
        scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        return body({
            entries: this.entries,
            shows: this.shows,
            appendEvents: (...events: DomainEvent<unknown>[]) => {
                this.appendedEvents.push(...events);
            },
        });
    }
}

describe('SaveEntryUseCase', () => {
    const fixedDate = new Date('2026-08-01T12:00:00.000Z');
    const input: SaveEntryInput = {
        id: ENTRY_ID,
        showId: SHOW_ID,
        dogName: 'Fido',
    };

    it('saves the entry derived from the input and the club scope', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const useCase = new SaveEntryUseCase(
            unitOfWork,
            new FakeClock(fixedDate),
            new FakeEventIdGenerator(),
        );

        await useCase.execute(input, clubScope);

        expect(unitOfWork.savedEntries).toHaveLength(1);
        expect(unitOfWork.savedEntries[0]).toStrictEqual({
            id: ENTRY_ID,
            clubId: asClubId(CLUB_ID),
            principalId: asPrincipalId(USER_ID),
            showId: SHOW_ID,
            dogName: 'Fido',
        });
    });

    it('appends an EntrySubmitted event carrying the saved entry id and dog name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const useCase = new SaveEntryUseCase(
            unitOfWork,
            new FakeClock(fixedDate),
            new FakeEventIdGenerator(),
        );

        await useCase.execute(input, clubScope);

        expect(unitOfWork.appendedEvents).toHaveLength(1);
        const event = unitOfWork.appendedEvents[0]!;
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.scope).toBe('club');
        expect(event.aggregateId).toBe(asAggregateId(ENTRY_ID));
        expect(event.payload).toStrictEqual({ dogName: 'Fido' });
        expect(event.occurredAt).toStrictEqual(fixedDate);
        expect(event.eventId).toBe('00000000-0000-4000-8000-000000000001');
    });

    it('rejects a non-club scope because an entry needs a Club owner', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const useCase = new SaveEntryUseCase(
            unitOfWork,
            new FakeClock(fixedDate),
            new FakeEventIdGenerator(),
        );
        const exhibitorScope: TransactionScope = {
            kind: 'exhibitor',
            principalId: asPrincipalId(USER_ID),
        };

        await expect(useCase.execute(input, exhibitorScope)).rejects.toThrow(/club/);
        expect(unitOfWork.savedEntries).toHaveLength(0);
        expect(unitOfWork.appendedEvents).toHaveLength(0);
    });
});
