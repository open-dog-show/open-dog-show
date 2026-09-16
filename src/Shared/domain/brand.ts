// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare const __brand: unique symbol;

/**
 * Compile-time brand helper. A branded type is structurally identical to `T` at
 * runtime but is treated as a distinct type by the TypeScript compiler,
 * preventing accidental substitution of one identifier / value-object kind for
 * another (e.g. passing a `PrincipalId` where a `ClubId` is expected).
 *
 * This is the single canonical definition in the shared kernel. Contexts re-use
 * it (directly or via a re-export) instead of re-declaring their own `Brand`,
 * so the helper lives in one place.
 */
export type Brand<T, B> = T & { readonly [__brand]: B };
