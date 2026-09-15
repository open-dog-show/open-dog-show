// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    InvalidDomainEventEnvelopeError,
    UnregisteredDomainEventTypeError,
    rehydrateDomainEvent,
    DomainEventRehydrationRegistry,
} from '../../../../src/Shared/infrastructure/messaging/domain-event-rehydration-registry.js';
import type { DomainEventFact } from '../../../../src/Shared/domain/domain-event.js';
import {
    asEventType,
    asClubId,
    type AggregateId,
} from '../../../../src/Shared/domain/domain-ids.js';

interface OrderedPayload {
    dogId: string;
    classNumber: number;
}

const CLUB_ID = asClubId('00000000-0000-4000-8000-0000000000aa');

// Minimal in-test class event exercising rehydration against a class rather
// than a generic envelope literal — rehydration only ever produces class
// events (ADR-0022, #176). Implements only the fact shape (ADR-0027): no
// eventId / occurredAt — those are envelope-only fields rehydration attaches
// afterwards.
class StubEntrySubmitted implements DomainEventFact {
    readonly type = asEventType('sample.EntrySubmitted');
    readonly scope: DomainEventFact['scope'];
    readonly aggregateId: AggregateId;
    readonly payload: OrderedPayload;

    constructor(fact: {
        scope: DomainEventFact['scope'];
        aggregateId: AggregateId;
        payload: unknown;
    }) {
        this.scope = fact.scope;
        this.aggregateId = fact.aggregateId;
        this.payload = fact.payload as OrderedPayload;
    }
}

function registryFor(
    rehydrate: (fact: DomainEventFact) => StubEntrySubmitted = (fact) =>
        new StubEntrySubmitted(fact),
) {
    const registry = new DomainEventRehydrationRegistry();
    registry.register(asEventType('sample.EntrySubmitted'), rehydrate);
    return registry;
}

describe('rehydrateDomainEvent — envelope validation', () => {
    const raw = {
        eventId: '00000000-0000-4000-8000-000000000001',
        type: 'sample.EntrySubmitted',
        occurredAt: '2026-08-01T12:00:00.000Z',
        scope: 'club' as const,
        clubId: CLUB_ID as string | null,
        principalId: null as string | null,
        aggregateId: 'entry-abc',
        payload: { dogId: 'dog-1', classNumber: 42 },
    };

    /** Drives {@link rehydrateDomainEvent} (which accepts `Date | string`) and narrows the thrown envelope error. */
    function catchRehydrate(occurredAt: Date | string): InvalidDomainEventEnvelopeError {
        try {
            rehydrateDomainEvent(
                {
                    eventId: raw.eventId,
                    type: raw.type,
                    occurredAt,
                    scope: raw.scope,
                    clubId: raw.clubId,
                    principalId: raw.principalId,
                    aggregateId: raw.aggregateId,
                    payload: raw.payload,
                },
                registryFor(),
            );
            throw new Error('expected rehydrateDomainEvent to throw');
        } catch (err) {
            if (err instanceof InvalidDomainEventEnvelopeError) return err;
            throw err;
        }
    }

    it('restores occurredAt as a Date', () => {
        const event = rehydrateDomainEvent(raw, registryFor());

        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.occurredAt.toISOString()).toBe('2026-08-01T12:00:00.000Z');
    });

    it('preserves all envelope fields', () => {
        const event = rehydrateDomainEvent(raw, registryFor());

        expect(event.eventId).toBe(raw.eventId);
        expect(event.type).toBe(raw.type);
        expect(event.scope.kind).toBe(raw.scope);
        expect(event.aggregateId).toBe(raw.aggregateId);
    });

    it('throws TypeError when the envelope type is not a valid <context>.<PascalName>', () => {
        expect(() => rehydrateDomainEvent({ ...raw, type: 'bogus' }, registryFor())).toThrow(
            TypeError,
        );
    });

    it('throws TypeError when the envelope scope is not a valid EventScope', () => {
        expect(() => rehydrateDomainEvent({ ...raw, scope: 'invalid' }, registryFor())).toThrow(
            TypeError,
        );
    });

    it('throws TypeError when the scope/id combination is invalid', () => {
        expect(() =>
            rehydrateDomainEvent({ ...raw, scope: 'club', clubId: null }, registryFor()),
        ).toThrow(TypeError);
    });

    it('throws InvalidDomainEventEnvelopeError when occurredAt is not a real date string', () => {
        expect(() =>
            rehydrateDomainEvent({ ...raw, occurredAt: 'not-a-real-date' }, registryFor()),
        ).toThrow(InvalidDomainEventEnvelopeError);
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
        const event = rehydrateDomainEvent(raw, registryFor());

        expectTypeOf(event.aggregateId).toEqualTypeOf<AggregateId>();
    });

    it('rehydrates into the registered class instance, not a generic envelope', () => {
        const event = rehydrateDomainEvent(raw, registryFor());

        expect(event).toBeInstanceOf(StubEntrySubmitted);
    });

    it('throws UnregisteredDomainEventTypeError when the type has no registered rehydrator', () => {
        const emptyRegistry = new DomainEventRehydrationRegistry();

        expect(() => rehydrateDomainEvent(raw, emptyRegistry)).toThrow(
            UnregisteredDomainEventTypeError,
        );
    });
});

describe('DomainEventRehydrationRegistry', () => {
    const raw = {
        eventId: '00000000-0000-4000-8000-000000000001',
        type: 'sample.EntrySubmitted',
        occurredAt: '2026-08-01T12:00:00.000Z',
        scope: 'club' as const,
        clubId: CLUB_ID as string | null,
        principalId: null as string | null,
        aggregateId: 'entry-abc',
        payload: { dogId: 'Fido', classNumber: 1 },
    };

    it('rehydratorFor returns undefined for an unregistered type', () => {
        const registry = new DomainEventRehydrationRegistry();
        expect(registry.rehydratorFor(asEventType('sample.EntrySubmitted'))).toBeUndefined();
    });

    it('rehydratorFor returns the registered rehydrator', () => {
        const registry = new DomainEventRehydrationRegistry();
        const rehydrator = (fact: DomainEventFact) => new StubEntrySubmitted(fact);
        registry.register(asEventType('sample.EntrySubmitted'), rehydrator);

        expect(registry.rehydratorFor(asEventType('sample.EntrySubmitted'))).toBe(rehydrator);
    });

    it('rehydrateDomainEvent delegates to the registered class rehydrator', () => {
        const registry = registryFor();

        const event = rehydrateDomainEvent(raw, registry);

        expect(event).toBeInstanceOf(StubEntrySubmitted);
        expect(event.eventId).toBe(raw.eventId);
        expect(event.type).toBe('sample.EntrySubmitted');
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.payload).toStrictEqual(raw.payload);
    });

    it('rehydrateDomainEvent throws UnregisteredDomainEventTypeError for an unregistered type', () => {
        const registry = new DomainEventRehydrationRegistry();

        expect(() => rehydrateDomainEvent(raw, registry)).toThrow(UnregisteredDomainEventTypeError);
    });

    it('UnregisteredDomainEventTypeError carries the offending event type', () => {
        const registry = new DomainEventRehydrationRegistry();

        try {
            rehydrateDomainEvent(raw, registry);
            throw new Error('expected rehydrateDomainEvent to throw');
        } catch (err) {
            if (!(err instanceof UnregisteredDomainEventTypeError)) throw err;
            expect(err.type).toBe('sample.EntrySubmitted');
            expect(err.name).toBe('UnregisteredDomainEventTypeError');
        }
    });
});
