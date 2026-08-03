// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

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
 * `IdGenerator` keeps ID-dependent logic deterministic and trivially
 * testable with an in-memory test double.
 */
export interface IdGenerator {
    /** Generates and returns a new unique ID string. */
    generate(): string;
}
