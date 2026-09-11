// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DomainEvent } from '../../../src/Shared/domain/domain-event.js';
import type { EventIdGenerator } from '../../../src/Shared/domain/domain-ports.js';
import {
    asAggregateId,
    asEventId,
    asEventType,
    type AggregateId,
    type EventId,
} from '../../../src/Shared/domain/domain-ids.js';

describe('EventIdGenerator port', () => {
    it('generate() returns a branded EventId', () => {
        expectTypeOf<ReturnType<EventIdGenerator['generate']>>().toEqualTypeOf<EventId>();
    });
});

describe('DomainEvent marker interface', () => {
    it('types aggregateId as AggregateId on the event', () => {
        expectTypeOf<DomainEvent['aggregateId']>().toEqualTypeOf<AggregateId>();
    });

    it('types payload as unknown on the marker interface', () => {
        expectTypeOf<DomainEvent['payload']>().toEqualTypeOf<unknown>();
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
