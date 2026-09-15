// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Compile-time exhaustiveness check for an unreachable `never` branch — the
 * shared implementation for every discriminated-scope switch in the kernel
 * (e.g. `EventScope`, `TransactionScope`): a future variant added without a
 * matching `case` fails to compile here (the narrowed type is no longer
 * `never`), rather than silently falling through to this `default` at
 * runtime.
 *
 * @param label Names the exhausted type in the thrown message, e.g.
 *   `'EventScope kind'`.
 */
export function assertNever(value: never, label: string): never {
    throw new Error(`Unexpected ${label}: ${String(value)}`);
}
