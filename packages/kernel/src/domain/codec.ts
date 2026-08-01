// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent, EventScope } from './DomainEvent.js';

/** The serialised (JSON-safe) form of a {@link DomainEvent}. */
export interface DomainEventJson {
  readonly eventId: string;
  readonly type: string;
  /** ISO-8601 timestamp. */
  readonly occurredAt: string;
  readonly scope: EventScope;
  readonly aggregateId: string;
  readonly payload: unknown;
}

/**
 * Encode a {@link DomainEvent} to a JSON-safe object.
 *
 * The `occurredAt` Date is converted to an ISO-8601 string; everything else
 * is left as-is (branded string ids are plain strings at runtime).
 */
export function encodeDomainEvent<TPayload>(
  event: DomainEvent<TPayload>,
): DomainEventJson {
  return {
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    scope: event.scope,
    aggregateId: event.aggregateId,
    payload: event.payload,
  };
}

/**
 * Decode a {@link DomainEventJson} back to a {@link DomainEvent}.
 *
 * The `occurredAt` ISO-8601 string is restored to a `Date`.
 */
export function decodeDomainEvent<TPayload>(
  json: DomainEventJson,
): DomainEvent<TPayload> {
  return {
    eventId: json.eventId,
    type: json.type,
    occurredAt: new Date(json.occurredAt),
    scope: json.scope,
    aggregateId: json.aggregateId,
    payload: json.payload as TPayload,
  };
}
