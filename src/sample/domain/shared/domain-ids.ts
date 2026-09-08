// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare const __brand: unique symbol;

/**
 * Compile-time brand helper — keeps the sample context's IDs distinct from
 * each other and from other strings even though all are plain strings at
 * runtime. A branded type is structurally identical to `T` at runtime but is
 * treated as a distinct type by the TypeScript compiler, preventing an
 * `EntryId` from being passed where a `ShowId` is expected.
 */
type Brand<T, B> = T & { readonly [__brand]: B };

/** Branded string that uniquely identifies an Entry within the sample context. */
export type EntryId = Brand<string, 'EntryId'>;
/** Branded string that uniquely identifies a Show within the sample context. */
export type ShowId = Brand<string, 'ShowId'>;

/**
 * Casts a raw string to an {@link EntryId}. Plain cast — no validation.
 * Call it at the outermost layer (repository, use-case boundary) so the rest
 * of the domain works exclusively with typed IDs.
 */
export const asEntryId = (id: string): EntryId => id as EntryId;
/** Casts a raw string to a {@link ShowId}. See {@link asEntryId}. */
export const asShowId = (id: string): ShowId => id as ShowId;
