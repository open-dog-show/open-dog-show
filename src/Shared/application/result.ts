// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainError } from '../domain/domain-error.js';

/**
 * The outcome of a use case whose caller must branch on expected domain
 * failures (E1).
 *
 * TypeScript has no typed throw channel, so expected failures belong in the
 * use case's return type: `{ ok: true, value }` for the happy path, `{ ok:
 * false, error }` for a domain error the caller handles. Bugs and technical
 * faults are **not** modelled here — they propagate as throws to the
 * outermost boundary handler (E4).
 *
 * Handle a `Result` exhaustively with the `never` idiom so adding a new
 * domain error to `E` turns a missed case into a compile error. Narrow on the
 * error *type* — `Error.name` is `string`, not a literal discriminant, so a
 * `switch` on `result.error.name` would not narrow `result.error` and the
 * `never` assignment would not compile:
 *
 * ```ts
 * if (result.ok) return result.value;
 * if (result.error instanceof UserSuspendedError) ...
 * else if (result.error instanceof InvalidProviderClaimsError) ...
 * else { const unreachable: never = result.error; throw unreachable; }
 * ```
 */
export type Result<T, E extends DomainError> =
    { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
