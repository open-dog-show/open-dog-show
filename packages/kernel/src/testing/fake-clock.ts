// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Clock } from '../domain/domain-ports.js';

/**
 * In-memory {@link Clock} implementation for use in unit tests.
 *
 * Time is frozen at construction and advances only when {@link tick} is
 * called explicitly — there is no real-time progression.  The default
 * epoch start (`new Date(0)`, i.e. 1970-01-01T00:00:00.000Z) makes
 * timestamps in test assertions trivially predictable.
 *
 * @example
 * ```ts
 * const clock = new FakeClock();
 * clock.now(); // 1970-01-01T00:00:00.000Z
 * clock.tick(1_000);
 * clock.now(); // 1970-01-01T00:00:01.000Z
 * ```
 */
export class FakeClock implements Clock {
    private current: number;

    /**
     * @param start - The instant the clock starts at.
     *   Defaults to `new Date(0)` (Unix epoch) for deterministic tests.
     */
    constructor(start: Date = new Date(0)) {
        this.current = start.getTime();
    }

    /** Returns the current frozen instant. */
    now(): Date {
        return new Date(this.current);
    }

    /**
     * Advances the clock by `ms` milliseconds.
     *
     * @param ms - Number of milliseconds to advance.  May be negative to
     *   move time backwards (useful for testing edge cases).
     */
    tick(ms: number): void {
        this.current += ms;
    }
}
