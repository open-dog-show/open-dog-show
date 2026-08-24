// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { EventId } from './domain-ids.js';

/**
 * Injection port for the current wall-clock time.
 *
 * Callers must never reach for `new Date()` directly; injecting `Clock`
 * keeps time-dependent logic deterministic and trivially testable with
 * an in-memory test double.
 */
export interface Clock {
    /** Returns the current instant as a `Date` object. */
    now(): Date;
}

/**
 * Injection port for opaque, unique-ID generation.
 *
 * Callers must never call `crypto.randomUUID()` directly; injecting
 * `EventIdGenerator` keeps ID-dependent logic deterministic and trivially
 * testable with an in-memory test double.
 *
 * The generated id is branded as an {@link EventId} so it cannot be silently
 * swapped for any other string — `createDomainEvent` flows that brand straight
 * through to `DomainEvent.eventId`.
 */
export interface EventIdGenerator {
    /** Generates and returns a new branded {@link EventId}. */
    generate(): EventId;
}
