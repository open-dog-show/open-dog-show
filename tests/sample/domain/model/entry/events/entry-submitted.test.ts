// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    asAggregateId,
    asClubId,
    asEventType,
    ClubEventScope,
    PlatformEventScope,
    type DomainEventFact,
} from '../../../../../../src/Shared/index.js';
import {
    EntrySubmitted,
    ENTRY_SUBMITTED_TYPE,
} from '../../../../../../src/sample/domain/model/entry/events/entry-submitted.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');

describe('EntrySubmitted.create', () => {
    it('constructs the fact from domain data only — no Clock/EventIdGenerator ports', () => {
        const event = EntrySubmitted.create(asAggregateId('entry-1'), ClubEventScope.of(CLUB_ID), {
            dogName: 'Fido',
        });

        expect(event).toBeInstanceOf(EntrySubmitted);
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.scope.kind).toBe('club');
        expect(event.aggregateId).toBe(asAggregateId('entry-1'));
        expect(event.payload).toStrictEqual({ dogName: 'Fido' });
    });

    it('is a DomainEventFact', () => {
        expectTypeOf(
            EntrySubmitted.create(asAggregateId('e'), ClubEventScope.of(CLUB_ID), {
                dogName: 'Fido',
            }),
        ).toMatchTypeOf<DomainEventFact>();
    });
});

describe('EntrySubmitted.rehydrate', () => {
    it('rebuilds the class fact from a stored row without ports', () => {
        const event = EntrySubmitted.rehydrate({
            scope: PlatformEventScope.of(),
            aggregateId: asAggregateId('entry-1'),
            payload: { dogName: 'Fido' },
        });

        expect(event).toBeInstanceOf(EntrySubmitted);
        expect(event.type).toBe('sample.EntrySubmitted');
    });

    it('rehydrates equal-by-field to a freshly created fact of the same data', () => {
        const created = EntrySubmitted.create(
            asAggregateId('entry-1'),
            ClubEventScope.of(CLUB_ID),
            {
                dogName: 'Fido',
            },
        );
        const rehydrated = EntrySubmitted.rehydrate({
            scope: created.scope,
            aggregateId: created.aggregateId,
            payload: created.payload,
        });

        expect(rehydrated).toEqual(created);
    });
});

describe('EntrySubmitted type + nominal brand', () => {
    it('exposes the fixed event-type string as ENTRY_SUBMITTED_TYPE', () => {
        expect(ENTRY_SUBMITTED_TYPE).toBe('sample.EntrySubmitted');
        expect(ENTRY_SUBMITTED_TYPE).toStrictEqual(asEventType('sample.EntrySubmitted'));
    });

    it('is not assignable from a structural fact literal (the #brand closes the leak)', () => {
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAnEvent: EntrySubmitted = {
            type: asEventType('sample.EntrySubmitted'),
            scope: ClubEventScope.of(CLUB_ID),
            aggregateId: asAggregateId('entry-1'),
            payload: { dogName: 'Fido' },
        };
        expect(notAnEvent).toBeDefined();
    });
});
