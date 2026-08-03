// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent } from './domain-event.js';

/**
 * Accumulates domain events during a unit-of-work transaction.
 *
 * Passed as the second argument to the `withOutboxTransaction` callback so callers
 * can queue events for atomic outbox-write without coupling to the transport.
 */
export interface OutboxAppender {
    append(...events: DomainEvent<unknown>[]): void;
}
