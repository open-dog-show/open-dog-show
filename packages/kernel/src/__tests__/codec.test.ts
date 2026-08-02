// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { decodeDomainEvent, encodeDomainEvent } from '../domain/codec.js';
import type { DomainEvent } from '../domain/DomainEvent.js';

interface OrderedPayload {
  dogId: string;
  classNumber: number;
}

describe('encodeDomainEvent', () => {
  const event: DomainEvent<OrderedPayload> = {
    eventId: '00000000-0000-4000-8000-000000000001',
    type: 'entries.EntrySubmitted',
    occurredAt: new Date('2026-08-01T12:00:00.000Z'),
    scope: 'tenant',
    aggregateId: 'entry-abc',
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
    expect(json.scope).toBe(event.scope);
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
    scope: 'tenant' as const,
    aggregateId: 'entry-abc',
    payload: { dogId: 'dog-1', classNumber: 42 },
  };

  it('restores occurredAt as a Date', () => {
    const event = decodeDomainEvent(raw);

    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.occurredAt.toISOString()).toBe('2026-08-01T12:00:00.000Z');
  });

  it('preserves all envelope fields', () => {
    const event = decodeDomainEvent(raw);

    expect(event.eventId).toBe(raw.eventId);
    expect(event.type).toBe(raw.type);
    expect(event.scope).toBe(raw.scope);
    expect(event.aggregateId).toBe(raw.aggregateId);
  });
});

describe('encode → JSON.stringify → JSON.parse → decode round-trip', () => {
  it('round-trips an event with Date payload field losslessly', () => {
    const original: DomainEvent<{ label: string }> = {
      eventId: '00000000-0000-4000-8000-000000000099',
      type: 'shows.ShowScheduled',
      occurredAt: new Date('2026-12-25T09:00:00.000Z'),
      scope: 'platform',
      aggregateId: 'show-1',
      payload: { label: 'Christmas Show 2026' },
    };

    const json = JSON.parse(JSON.stringify(encodeDomainEvent(original)));
    const restored = decodeDomainEvent(json);

    expect(restored.eventId).toBe(original.eventId);
    expect(restored.type).toBe(original.type);
    expect(restored.occurredAt).toStrictEqual(original.occurredAt);
    expect(restored.scope).toBe(original.scope);
    expect(restored.aggregateId).toBe(original.aggregateId);
    expect(restored.payload).toStrictEqual(original.payload);
  });
});
