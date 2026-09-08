// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Asserts that a fixture lookup succeeded: returns `value` narrowed to `T`, or
 * throws a readable error naming `description` when the lookup yielded
 * `undefined`. Replaces the `arr.find(...)!` / `cls!.field` pattern so a missing
 * fixture surfaces as a clear assertion failure (with the searched id) instead
 * of a `TypeError: Cannot read properties of undefined`.
 */
export function findOrFail<T>(value: T | undefined, description: string): T {
    if (value === undefined) {
        throw new Error(
            `Expected to find ${description}, but it was absent (fixture lookup failed)`,
        );
    }
    return value;
}
