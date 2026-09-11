// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    decodeDomainEvent,
    encodeDomainEvent,
    InvalidDomainEventEnvelopeError,
    rehydrateDomainEvent,
    DomainEventRehydrationRegistry,
} from '../../../src/Shared/domain/domain-event-codec.js';
import type { DomainEvent } from '../../../src/Shared/domain/domain-event.js';
import { EventScope } from '../../../src/Shared/domain/event-scope.js';
import {
    asAggregateId,
    asEventId,
    asEventType,
    type AggregateId,
} from '../../../src/Shared/domain/domain-ids.js';

interface OrderedPayload {
    dogId: string;
    classNumber: number;
}

describe('encodeDomainEvent', () => {
    const event: DomainEvent<OrderedPayload> = {
        eventId: asEventId('00000000-0000-4000-8000-000000000001'),
        type: asEventType('entries.EntrySubmitted'),
        occurredAt: new Date('2026-08-01T12:00:00.000Z'),
        scope: EventScope.club(),
        aggregateId: asAggregateId('entry-abc'),
        payload: { dogId: 'dog-1', classNumber: 42 },
    };

    it('serialises occurredAt as ISO-8601 string', () => {
        const json = encodeDomainEvent(event);

        expect(json.occurredAt).toBe('2026-08-01T12:00:00.000Z');
    });

    it('preserves all envelope fields', () => {
        const json = encodeDomainEvent(event);

        expect(json.eventId).toBe(event.eventId);
        expect(json.type).toBe(event.type);
        expect(json.scope).toBe(event.scope.kind);
        expect(json.aggregateId).toBe(event.aggregateId);
    });

    it('preserves the payload as-is', () => {
        const json = encodeDomainEvent(event);

        expect(json.payload).toStrictEqual({ dogId: 'dog-1', classNumber: 42 });
    });
});

describe('decodeDomainEvent', () => {
    const raw = {
        eventId: '00000000-0000-4000-8000-000000000001',
        type: 'entries.EntrySubmitted',
        occurredAt: '2026-08-01T12:00:00.000Z',
        scope: 'club' as const,
        aggregateId: 'entry-abc',
        payload: { dogId: 'dog-1', classNumber: 42 },
    };

    /** Drives {@link rehydrateDomainEvent} (which accepts `Date | string`) and narrows the thrown envelope error. */
    function catchRehydrate(occurredAt: Date | string): InvalidDomainEventEnvelopeError {
        try {
            rehydrateDomainEvent({
                eventId: raw.eventId,
                type: raw.type,
                occurredAt,
                scope: raw.scope,
                aggregateId: raw.aggregateId,
                payload: raw.payload,
            });
            throw new Error('expected rehydrateDomainEvent to throw');
        } catch (err) {
            if (err instanceof InvalidDomainEventEnvelopeError) return err;
            throw err;
        }
    }

    it('restores occurredAt as a Date', () => {
        const event = decodeDomainEvent(raw);

        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.occurredAt.toISOString()).toBe('2026-08-01T12:00:00.000Z');
    });

    it('preserves all envelope fields', () => {
        const event = decodeDomainEvent(raw);

        expect(event.eventId).toBe(raw.eventId);
        expect(event.type).toBe(raw.type);
        expect(event.scope.kind).toBe(raw.scope);
        expect(event.aggregateId).toBe(raw.aggregateId);
    });

    it('throws TypeError when the JSON type is not a valid <context>.<PascalName>', () => {
        expect(() => decodeDomainEvent({ ...raw, type: 'bogus' })).toThrow(TypeError);
    });

    it('throws TypeError when the JSON scope is not a valid EventScope', () => {
        expect(() => decodeDomainEvent({ ...raw, scope: 'invalid' })).toThrow(TypeError);
    });

    it('throws InvalidDomainEventEnvelopeError when occurredAt is not a real date string', () => {
        expect(() => decodeDomainEvent({ ...raw, occurredAt: 'not-a-real-date' })).toThrow(
            InvalidDomainEventEnvelopeError,
        );
    });

    it('InvalidDomainEventEnvelopeError carries the offending string value (E5)', () => {
        const error = catchRehydrate('garbage');
        expect(error).toBeInstanceOf(InvalidDomainEventEnvelopeError);
        expect(error.field).toBe('occurredAt');
        expect(error.value).toBe('garbage');
        expect(error.name).toBe('InvalidDomainEventEnvelopeError');
    });

    it('rejects an Invalid Date instance, not just a bad string', () => {
        const invalid = new Date('garbage');
        const error = catchRehydrate(invalid);
        expect(error).toBeInstanceOf(InvalidDomainEventEnvelopeError);
        expect(error.field).toBe('occurredAt');
        expect(error.value).toBe(invalid);
        expect(Number.isNaN((error.value as Date).getTime())).toBe(true);
    });

    it('rejects a rollover calendar date that new Date would normalise (2026-02-30 → March 2)', () => {
        // `new Date('2026-02-30T00:00:00.000Z')` silently rolls to March 2; the
        // strict ISO parse rejects the rollover so corrupt envelope data cannot
        // become a subtly-wrong typed event.
        const error = catchRehydrate('2026-02-30T00:00:00.000Z');
        expect(error).toBeInstanceOf(InvalidDomainEventEnvelopeError);
        expect(error.field).toBe('occurredAt');
        expect(error.value).toBe('2026-02-30T00:00:00.000Z');
    });

    it('restores aggregateId as a branded AggregateId', () => {
        const event = decodeDomainEvent(raw);

        expectTypeOf(event.aggregateId).toEqualTypeOf<AggregateId>();
    });

    it('does not advertise a payload type parameter', () => {
        const event = decodeDomainEvent(raw);

        // Returning `unknown` is the safety guarantee of dropping the phantom
        // generic — the codec cannot validate a payload shape, so it must not
        // promise one.
        expectTypeOf(event.payload).toEqualTypeOf<unknown>();

        // @ts-expect-error decodeDomainEvent takes no type parameter.
        const typed = decodeDomainEvent<OrderedPayload>(raw);
        expect(typed.payload).toBeDefined();
    });
});

describe('encode → JSON.stringify → JSON.parse → decode round-trip', () => {
    it('round-trips an event with Date payload field losslessly', () => {
        const original: DomainEvent<{ label: string }> = {
            eventId: asEventId('00000000-0000-4000-8000-000000000099'),
            type: asEventType('shows.ShowScheduled'),
            occurredAt: new Date('2026-12-25T09:00:00.000Z'),
            scope: EventScope.platform(),
            aggregateId: asAggregateId('show-1'),
            payload: { label: 'Christmas Show 2026' },
        };

        const json = JSON.parse(JSON.stringify(encodeDomainEvent(original)));
        const restored = decodeDomainEvent(json);

        expect(restored.eventId).toBe(original.eventId);
        expect(restored.type).toBe(original.type);
        expect(restored.occurredAt).toStrictEqual(original.occurredAt);
        expect(restored.scope).toStrictEqual(original.scope);
        expect(restored.aggregateId).toBe(original.aggregateId);
        expect(restored.payload).toStrictEqual(original.payload);
    });
});

describe('DomainEventRehydrationRegistry', () => {
    // Minimal in-test class event exercising the registry wiring.
    class StubEntrySubmitted implements DomainEvent<{ dogName: string }> {
        readonly type = asEventType('sample.EntrySubmitted');
        readonly eventId: ReturnType<typeof asEventId>;
        readonly occurredAt: Date;
        readonly scope: EventScope;
        readonly aggregateId: ReturnType<typeof asAggregateId>;
        readonly payload: { dogName: string };

        constructor(envelope: {
            eventId: ReturnType<typeof asEventId>;
            occurredAt: Date;
            scope: EventScope;
            aggregateId: ReturnType<typeof asAggregateId>;
            payload: unknown;
        }) {
            this.eventId = envelope.eventId;
            this.occurredAt = envelope.occurredAt;
            this.scope = envelope.scope;
            this.aggregateId = envelope.aggregateId;
            this.payload = envelope.payload as { dogName: string };
        }
    }

    const raw = {
        eventId: '00000000-0000-4000-8000-000000000001',
        type: 'sample.EntrySubmitted',
        occurredAt: '2026-08-01T12:00:00.000Z',
        scope: 'club' as const,
        aggregateId: 'entry-abc',
        payload: { dogName: 'Fido' },
    };

    it('rehydratorFor returns undefined for an unregistered type', () => {
        const registry = new DomainEventRehydrationRegistry();
        expect(registry.rehydratorFor(asEventType('sample.EntrySubmitted'))).toBeUndefined();
    });

    it('rehydratorFor returns the registered rehydrator', () => {
        const registry = new DomainEventRehydrationRegistry();
        const rehydrator = () =>
            new StubEntrySubmitted({
                eventId: asEventId('x'),
                occurredAt: new Date(0),
                scope: EventScope.club(),
                aggregateId: asAggregateId('x'),
                payload: { dogName: 'x' },
            });
        registry.register(asEventType('sample.EntrySubmitted'), rehydrator);

        expect(registry.rehydratorFor(asEventType('sample.EntrySubmitted'))).toBe(rehydrator);
    });

    it('rehydrateDomainEvent delegates to the registered class rehydrator', () => {
        const registry = new DomainEventRehydrationRegistry();
        registry.register(
            asEventType('sample.EntrySubmitted'),
            (envelope) =>
                new StubEntrySubmitted({
                    eventId: envelope.eventId,
                    occurredAt: envelope.occurredAt,
                    scope: envelope.scope,
                    aggregateId: envelope.aggregateId,
                    payload: envelope.payload,
                }),
        );

        const event = rehydrateDomainEvent(raw, registry);

        expect(event).toBeInstanceOf(StubEntrySubmitted);
        expect(event.eventId).toBe(raw.eventId);
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.payload).toStrictEqual({ dogName: 'Fido' });
    });

    it('rehydrateDomainEvent falls back to the generic envelope for an unregistered type', () => {
        const registry = new DomainEventRehydrationRegistry();

        const event = rehydrateDomainEvent(raw, registry);

        // No class rehydrator registered → the generic envelope object is returned.
        expect(event).not.toBeInstanceOf(StubEntrySubmitted);
        expect(event.eventId).toBe(raw.eventId);
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.payload).toStrictEqual({ dogName: 'Fido' });
    });

    it('rehydrateDomainEvent without a registry still returns the generic envelope', () => {
        const event = rehydrateDomainEvent(raw);

        expect(event.eventId).toBe(raw.eventId);
        expect(event.type).toBe('sample.EntrySubmitted');
    });
});
