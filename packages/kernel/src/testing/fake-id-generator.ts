// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IdGenerator } from '../domain/domain-ports.js';

/**
 * In-memory {@link IdGenerator} implementation for use in unit tests.
 *
 * Generates deterministic, human-readable UUIDs by incrementing a
 * numeric counter starting at `seed`.  The produced strings are
 * valid UUID v4 format:
 *
 * ```
 * 00000000-0000-4000-8000-<12-digit-decimal-counter>
 * ```
 *
 * The version nibble (`4`) and variant nibble (`8`) are fixed constants;
 * only the last 12 digits vary.  This makes IDs easy to spot in
 * assertion output while still satisfying UUID-shaped validation.
 *
 * @example
 * ```ts
 * const ids = new FakeIdGenerator();
 * ids.generate(); // '00000000-0000-4000-8000-000000000001'
 * ids.generate(); // '00000000-0000-4000-8000-000000000002'
 * ids.reset();
 * ids.generate(); // '00000000-0000-4000-8000-000000000001'
 * ```
 */
export class FakeIdGenerator implements IdGenerator {
    private counter: number;
    private readonly seed: number;

    /**
     * @param seed - The starting counter value; also the value restored by
     *   {@link reset}.  Defaults to `1`.
     */
    constructor(seed = 1) {
        this.seed = seed;
        this.counter = seed;
    }

    /** Returns the next deterministic UUID and increments the counter. */
    generate(): string {
        const n = this.counter++;
        const suffix = n.toString(10).padStart(12, '0');
        return `00000000-0000-4000-8000-${suffix}`;
    }

    /**
     * Resets the counter back to the seed value supplied at construction.
     *
     * Useful in `beforeEach` hooks to guarantee identical ID sequences
     * across test cases.
     */
    reset(): void {
        this.counter = this.seed;
    }
}
