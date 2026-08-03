// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare const __brand: unique symbol;

/**
 * Compile-time brand helper.
 *
 * A branded type is structurally identical to `T` at runtime but is
 * treated as a distinct type by the TypeScript compiler.  This prevents
 * accidental substitution of one ID kind for another (e.g. passing a
 * `DogId` where a `ShowId` is expected).
 */
type Brand<T, B> = T & { readonly [__brand]: B };

/** Branded string that uniquely identifies a dog show. */
export type ShowId = Brand<string, 'ShowId'>;
/** Branded string that uniquely identifies a dog. */
export type DogId = Brand<string, 'DogId'>;
/** Branded string that uniquely identifies a kennel-club tenant. */
export type TenantId = Brand<string, 'TenantId'>;
/** Branded string that uniquely identifies an exhibitor. */
export type ExhibitorId = Brand<string, 'ExhibitorId'>;
/** Branded string that uniquely identifies a user account. */
export type AccountId = Brand<string, 'AccountId'>;

/**
 * Casts a raw string to a {@link ShowId}.
 *
 * These `as*` constructors are the **only** safe boundary-crossing points
 * where an untyped string (e.g. from a database row or HTTP request)
 * becomes a typed domain ID.  Prefer calling them at the outermost layer
 * (repository, controller) so the rest of the domain works exclusively
 * with typed IDs.
 */
export const asShowId = (id: string): ShowId => id as ShowId;
/** Casts a raw string to a {@link DogId}. See {@link asShowId}. */
export const asDogId = (id: string): DogId => id as DogId;
/** Casts a raw string to a {@link TenantId}. See {@link asShowId}. */
export const asTenantId = (id: string): TenantId => id as TenantId;
/** Casts a raw string to an {@link ExhibitorId}. See {@link asShowId}. */
export const asExhibitorId = (id: string): ExhibitorId => id as ExhibitorId;
/** Casts a raw string to an {@link AccountId}. See {@link asShowId}. */
export const asAccountId = (id: string): AccountId => id as AccountId;
