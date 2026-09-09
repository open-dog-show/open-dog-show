// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asAggregateId,
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    FakeClock,
    FakeEventIdGenerator,
    type TransactionScope,
} from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import {
    SaveEntryUseCase,
    InvalidTransactionScopeError,
    type SaveEntryInput,
} from '../../../../src/sample/application/save-entry/save-entry.js';

// Fixed deterministic IDs.
const CLUB_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000011';
const SHOW_ID = '00000000-0000-4000-8000-000000000021';
const ENTRY_ID = '00000000-0000-4000-8000-000000000031';

const clubScope: TransactionScope = ClubTransactionScope.of(
    asClubId(CLUB_ID),
    asPrincipalId(USER_ID),
);

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
        expect(event.scope.kind).toBe('club');
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
        const exhibitorScope: TransactionScope = ExhibitorTransactionScope.of(
            asPrincipalId(USER_ID),
        );

        await expect(useCase.execute(input, exhibitorScope)).rejects.toThrow(
            InvalidTransactionScopeError,
        );
        expect(unitOfWork.savedEntries).toHaveLength(0);
        expect(unitOfWork.appendedEvents).toHaveLength(0);
    });
});
