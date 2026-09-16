// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asAggregateId,
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PlatformTransactionScope,
    ScopeMismatchError,
    type TransactionScope,
} from '../../../../src/Shared/index.js';
import { FakeClock } from '../../../../src/Shared/infrastructure/persistence/inmemory/fake-clock.js';
import { FakeEventIdGenerator } from '../../../../src/Shared/infrastructure/persistence/inmemory/fake-event-id-generator.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { Entry } from '../../../../src/sample/domain/model/entry/entry.js';
import { EntrySubmitted } from '../../../../src/sample/domain/model/entry/events/entry-submitted.js';
import { Show, ShowNotFoundError } from '../../../../src/sample/domain/model/show/show.js';
import { asShowId } from '../../../../src/sample/domain/shared/domain-ids.js';
import {
    SaveEntryUseCase,
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

    function useCaseWith(unitOfWork: FakeSampleUnitOfWork): SaveEntryUseCase {
        return new SaveEntryUseCase(unitOfWork);
    }

    function unitOfWorkWithShow(clubId = CLUB_ID): FakeSampleUnitOfWork {
        const unitOfWork = new FakeSampleUnitOfWork(
            new FakeClock(fixedDate),
            new FakeEventIdGenerator(),
        );
        unitOfWork.seededShows.push(
            Show.create(asShowId(SHOW_ID), asClubId(clubId), 'Spring Show'),
        );
        return unitOfWork;
    }

    it('saves the entry owned by the Show it is submitted to, under a club scope', async () => {
        const unitOfWork = unitOfWorkWithShow();

        await useCaseWith(unitOfWork).execute(input, clubScope);

        expect(unitOfWork.savedEntries).toHaveLength(1);
        const saved = unitOfWork.savedEntries[0]!;
        expect(saved).toBeInstanceOf(Entry);
        // `toEqual` (not `toStrictEqual`) because `Entry` is a nominal class —
        // its prototype differs from a plain literal's. The `#brand` private
        // field is not an own enumerable property, so the five domain fields
        // still compare equal.
        expect(saved).toEqual({
            id: ENTRY_ID,
            clubId: asClubId(CLUB_ID),
            createdBy: asPrincipalId(USER_ID),
            showId: SHOW_ID,
            dogName: 'Fido',
        });
    });

    it('derives clubId from the Show, not the acting scope, even under an exhibitor-acting scope (hybrid aggregate, ADR-0026)', async () => {
        const unitOfWork = unitOfWorkWithShow();
        const exhibitorScope: TransactionScope = ExhibitorTransactionScope.of(
            asPrincipalId(USER_ID),
        );

        await useCaseWith(unitOfWork).execute(input, exhibitorScope);

        expect(unitOfWork.savedEntries).toHaveLength(1);
        const saved = unitOfWork.savedEntries[0]!;
        expect(saved.clubId).toBe(asClubId(CLUB_ID));
        expect(saved.createdBy).toBe(asPrincipalId(USER_ID));
    });

    it('rejects a showId that names no Show (ShowNotFoundError) rather than trusting a caller-supplied clubId', async () => {
        const unitOfWork = new FakeSampleUnitOfWork(
            new FakeClock(fixedDate),
            new FakeEventIdGenerator(),
        );
        // No show seeded.

        await expect(useCaseWith(unitOfWork).execute(input, clubScope)).rejects.toThrow(
            ShowNotFoundError,
        );
        expect(unitOfWork.savedEntries).toHaveLength(0);
        expect(unitOfWork.recordedEvents).toHaveLength(0);
    });

    it('records an EntrySubmitted event carrying the saved entry id and dog name', async () => {
        const unitOfWork = unitOfWorkWithShow();

        await useCaseWith(unitOfWork).execute(input, clubScope);

        expect(unitOfWork.recordedEvents).toHaveLength(1);
        const event = unitOfWork.recordedEvents[0]!;
        expect(event).toBeInstanceOf(EntrySubmitted);
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.scope.kind).toBe('club');
        expect(event.aggregateId).toBe(asAggregateId(ENTRY_ID));
        expect(event.payload).toStrictEqual({ dogName: 'Fido' });
        expect(event.occurredAt).toStrictEqual(fixedDate);
        expect(event.eventId).toBe('00000000-0000-4000-8000-000000000001');
    });

    it('rejects a platform scope because there is no acting principal (ScopeMismatchError)', async () => {
        const unitOfWork = unitOfWorkWithShow();

        await expect(
            useCaseWith(unitOfWork).execute(input, PlatformTransactionScope.of()),
        ).rejects.toThrow(ScopeMismatchError);
        expect(unitOfWork.savedEntries).toHaveLength(0);
        expect(unitOfWork.recordedEvents).toHaveLength(0);
    });
});
