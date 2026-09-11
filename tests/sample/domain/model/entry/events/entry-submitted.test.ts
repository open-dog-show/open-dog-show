// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    asAggregateId,
    asEventId,
    asEventType,
    EventScope,
    FakeClock,
    FakeEventIdGenerator,
    type Clock,
    type DomainEvent,
    type EventIdGenerator,
} from '../../../../../../src/Shared/index.js';
import {
    EntrySubmitted,
    ENTRY_SUBMITTED_TYPE,
} from '../../../../../../src/sample/domain/model/entry/events/entry-submitted.js';

const FIXED_DATE = new Date('2026-08-01T12:00:00.000Z');
const FIXED_ID = '00000000-0000-4000-8000-000000000001';

const clock: Clock = new FakeClock(FIXED_DATE);
const eventIdGenerator: EventIdGenerator = new FakeEventIdGenerator();

describe('EntrySubmitted.from', () => {
    it('defaults eventId and occurredAt to the injected Clock / EventIdGenerator', () => {
        const event = EntrySubmitted.from(
            {
                scope: EventScope.club(),
                aggregateId: asAggregateId('entry-1'),
                payload: { dogName: 'Fido' },
            },
            { clock, eventIdGenerator },
        );

        expect(event).toBeInstanceOf(EntrySubmitted);
        expect(event.eventId).toBe(FIXED_ID);
        expect(event.occurredAt).toStrictEqual(FIXED_DATE);
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.scope.kind).toBe('club');
        expect(event.aggregateId).toBe(asAggregateId('entry-1'));
        expect(event.payload).toStrictEqual({ dogName: 'Fido' });
    });

    it('honours explicit eventId / occurredAt overrides (deterministic tests)', () => {
        const explicitId = asEventId('00000000-0000-4000-8000-000000000099');
        const explicitDate = new Date('2025-01-01T00:00:00.000Z');

        const event = EntrySubmitted.from(
            {
                scope: EventScope.platform(),
                aggregateId: asAggregateId('entry-1'),
                payload: { dogName: 'Rex' },
                eventId: explicitId,
                occurredAt: explicitDate,
            },
            { clock, eventIdGenerator },
        );

        expect(event.eventId).toBe(explicitId);
        expect(event.occurredAt).toBe(explicitDate);
    });

    it('is a DomainEvent', () => {
        expectTypeOf(
            EntrySubmitted.from(
                {
                    scope: EventScope.club(),
                    aggregateId: asAggregateId('e'),
                    payload: { dogName: 'Fido' },
                },
                { clock, eventIdGenerator },
            ),
        ).toMatchTypeOf<DomainEvent>();
    });
});

describe('EntrySubmitted.rehydrate', () => {
    it('rebuilds the class event from a stored envelope without ports', () => {
        const event = EntrySubmitted.rehydrate({
            eventId: asEventId(FIXED_ID),
            occurredAt: FIXED_DATE,
            scope: EventScope.club(),
            aggregateId: asAggregateId('entry-1'),
            payload: { dogName: 'Fido' },
        });

        expect(event).toBeInstanceOf(EntrySubmitted);
        expect(event.eventId).toBe(FIXED_ID);
        expect(event.occurredAt).toBe(FIXED_DATE);
        expect(event.type).toBe('sample.EntrySubmitted');
    });

    it('rehydrates equal-by-field to a freshly emitted event of the same data', () => {
        const emitted = EntrySubmitted.from(
            {
                scope: EventScope.club(),
                aggregateId: asAggregateId('entry-1'),
                payload: { dogName: 'Fido' },
                eventId: asEventId(FIXED_ID),
                occurredAt: FIXED_DATE,
            },
            { clock, eventIdGenerator },
        );
        const rehydrated = EntrySubmitted.rehydrate({
            eventId: emitted.eventId,
            occurredAt: emitted.occurredAt,
            scope: emitted.scope,
            aggregateId: emitted.aggregateId,
            payload: emitted.payload,
        });

        expect(rehydrated).toEqual(emitted);
    });
});

describe('EntrySubmitted type + nominal brand', () => {
    it('exposes the fixed event-type string as ENTRY_SUBMITTED_TYPE', () => {
        expect(ENTRY_SUBMITTED_TYPE).toBe('sample.EntrySubmitted');
        expect(ENTRY_SUBMITTED_TYPE).toStrictEqual(asEventType('sample.EntrySubmitted'));
    });

    it('is not assignable from a structural envelope literal (the #brand closes the leak)', () => {
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAnEvent: EntrySubmitted = {
            eventId: asEventId(FIXED_ID),
            type: asEventType('sample.EntrySubmitted'),
            occurredAt: FIXED_DATE,
            scope: EventScope.club(),
            aggregateId: asAggregateId('entry-1'),
            payload: { dogName: 'Fido' },
        };
        expect(notAnEvent).toBeDefined();
    });
});
