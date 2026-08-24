// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    createDomainEvent,
    type CreateDomainEventParams,
    type DomainEvent,
} from '../domain/domain-event.js';
import type { Clock, EventIdGenerator } from '../domain/domain-ports.js';
import {
    asAggregateId,
    asEventId,
    asEventType,
    type AggregateId,
    type EventId,
} from '../domain/domain-ids.js';

describe('createDomainEvent', () => {
    const FIXED_DATE = new Date('2026-08-01T12:00:00.000Z');
    const FIXED_ID = '00000000-0000-4000-8000-000000000001';

    const clock: Clock = { now: () => FIXED_DATE };
    const eventIdGenerator: EventIdGenerator = { generate: () => asEventId(FIXED_ID) };

    it('creates an event envelope with injected clock and id-generator', () => {
        const event = createDomainEvent(
            {
                type: asEventType('entries.EntrySubmitted'),
                scope: 'tenant',
                aggregateId: asAggregateId('entry-1'),
                payload: { dogId: 'dog-1' },
            },
            { clock, eventIdGenerator },
        );

        expect(event).toStrictEqual({
            eventId: FIXED_ID,
            type: 'entries.EntrySubmitted',
            occurredAt: FIXED_DATE,
            scope: 'tenant',
            aggregateId: 'entry-1',
            payload: { dogId: 'dog-1' },
        });
    });

    it('uses an explicit eventId and occurredAt when provided', () => {
        const explicitId = '00000000-0000-4000-8000-000000000002';
        const explicitDate = new Date('2025-01-01T00:00:00.000Z');

        const event = createDomainEvent(
            {
                type: asEventType('rulesets.RulesetPublished'),
                scope: 'platform',
                aggregateId: asAggregateId('ruleset-1'),
                payload: null,
                eventId: asEventId(explicitId),
                occurredAt: explicitDate,
            },
            { clock, eventIdGenerator },
        );

        expect(event.eventId).toBe(explicitId);
        expect(event.occurredAt).toBe(explicitDate);
    });

    it('uses platform scope for operator-owned events', () => {
        const event = createDomainEvent(
            {
                type: asEventType('admin.ClubOnboarded'),
                scope: 'platform',
                aggregateId: asAggregateId('club-1'),
                payload: {},
            },
            { clock, eventIdGenerator },
        );

        expect(event.scope).toBe('platform');
    });

    it('uses exhibitor scope for cross-tenant events', () => {
        const event = createDomainEvent(
            {
                type: asEventType('entries.DogRegistered'),
                scope: 'exhibitor',
                aggregateId: asAggregateId('dog-1'),
                payload: {},
            },
            { clock, eventIdGenerator },
        );

        expect(event.scope).toBe('exhibitor');
    });
});

describe('EventIdGenerator port', () => {
    it('generate() returns a branded EventId', () => {
        expectTypeOf<ReturnType<EventIdGenerator['generate']>>().toEqualTypeOf<EventId>();
    });
});

describe('DomainEvent envelope brands', () => {
    it('types aggregateId as AggregateId on the event', () => {
        expectTypeOf<DomainEvent<unknown>['aggregateId']>().toEqualTypeOf<AggregateId>();
    });

    it('types aggregateId as AggregateId on the create params', () => {
        expectTypeOf<
            CreateDomainEventParams<unknown>['aggregateId']
        >().toEqualTypeOf<AggregateId>();
    });
});

describe('asEventId', () => {
    it('casts a raw string through to an EventId-typed value', () => {
        const id = '00000000-0000-4000-8000-000000000001';

        expect(asEventId(id)).toBe(id);
    });
});

describe('asAggregateId', () => {
    it('casts a raw string through to an AggregateId-typed value', () => {
        const id = 'entry-1';
        const branded = asAggregateId(id);

        expect(branded).toBe(id);
        expectTypeOf(branded).toEqualTypeOf<AggregateId>();
    });
});

describe('AggregateId brand isolation', () => {
    it('rejects a raw string where an AggregateId is required', () => {
        // @ts-expect-error a raw string must not satisfy AggregateId
        const agg: AggregateId = 'entry-1';
        expect(agg).toStrictEqual(asAggregateId('entry-1'));
    });

    it('rejects an EventId where an AggregateId is required (cross-id)', () => {
        const eventId: EventId = asEventId('00000000-0000-4000-8000-000000000001');
        // @ts-expect-error an EventId must not satisfy AggregateId
        const agg: AggregateId = eventId;
        expect(agg).toStrictEqual(asAggregateId('00000000-0000-4000-8000-000000000001'));
    });

    it('rejects an AggregateId where an EventId is required (cross-id)', () => {
        const agg: AggregateId = asAggregateId('entry-1');
        // @ts-expect-error an AggregateId must not satisfy EventId
        const eventId: EventId = agg;
        expect(eventId).toStrictEqual(asEventId('entry-1'));
    });
});

describe('asEventType', () => {
    it('accepts a well-formed <context>.<PascalName> and returns it unchanged', () => {
        expect(asEventType('entries.EntrySubmitted')).toBe('entries.EntrySubmitted');
    });

    it('accepts a single-letter context and PascalName', () => {
        expect(asEventType('a.B')).toBe('a.B');
    });

    it.each([
        ['missing the dot separator', 'EntrySubmitted'],
        ['context not lowercase', 'Entries.EntrySubmitted'],
        ['event name not PascalCase', 'entries.entrySubmitted'],
        ['empty context', '.EntrySubmitted'],
        ['empty event name', 'entries.'],
        ['empty string', ''],
        ['extra dot segment', 'a.b.c'],
        ['trailing dot', 'entries.EntrySubmitted.'],
        ['leading dot', '.entries.EntrySubmitted'],
        ['trailing newline', 'entries.EntrySubmitted\n'],
        ['trailing carriage return', 'entries.EntrySubmitted\r'],
    ])('throws TypeError when the value %s', (_label, value) => {
        expect(() => asEventType(value)).toThrow(TypeError);
    });
});
