// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { createDomainEvent } from '../domain/domain-event.js';
import type { Clock, IdGenerator } from '../domain/domain-ports.js';

describe('createDomainEvent', () => {
  const FIXED_DATE = new Date('2026-08-01T12:00:00.000Z');
  const FIXED_ID = '00000000-0000-4000-8000-000000000001';

  const clock: Clock = { now: () => FIXED_DATE };
  const idGenerator: IdGenerator = { generate: () => FIXED_ID };

  it('creates an event envelope with injected clock and id-generator', () => {
    const event = createDomainEvent(
      {
        type: 'entries.EntrySubmitted',
        scope: 'tenant',
        aggregateId: 'entry-1',
        payload: { dogId: 'dog-1' },
      },
      { clock, idGenerator },
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
        type: 'rulesets.RulesetPublished',
        scope: 'platform',
        aggregateId: 'ruleset-1',
        payload: null,
        eventId: explicitId,
        occurredAt: explicitDate,
      },
      { clock, idGenerator },
    );

    expect(event.eventId).toBe(explicitId);
    expect(event.occurredAt).toBe(explicitDate);
  });

  it('uses platform scope for operator-owned events', () => {
    const event = createDomainEvent(
      { type: 'admin.ClubOnboarded', scope: 'platform', aggregateId: 'club-1', payload: {} },
      { clock, idGenerator },
    );

    expect(event.scope).toBe('platform');
  });

  it('uses exhibitor scope for cross-tenant events', () => {
    const event = createDomainEvent(
      { type: 'entries.DogRegistered', scope: 'exhibitor', aggregateId: 'dog-1', payload: {} },
      { clock, idGenerator },
    );

    expect(event.scope).toBe('exhibitor');
  });
});
