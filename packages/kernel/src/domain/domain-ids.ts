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
/**
 * Branded string for cross-context reference to an Exhibitor (Entries & Registration).
 * Reference-only cross-context ID per ADR-0006 — not the Entries context's identity port.
 */
export type ExhibitorId = Brand<string, 'ExhibitorId'>;
/** Branded string that uniquely identifies a user in the Identity & Access context. */
export type UserId = Brand<string, 'UserId'>;
/** Branded event-occurrence identifier; doubles as the outbox idempotency key. */
export type DomainEventId = Brand<string, 'DomainEventId'>;
/** Branded fully-qualified event type name, e.g. `'entries.EntrySubmitted'`. */
export type EventTypeName = Brand<string, 'EventTypeName'>;
/**
 * Context-neutral RLS isolation key carried in {@link TransactionScope}.
 *
 * Using `ActorId` rather than `UserId` decouples the transaction-scoping
 * mechanism from the IAM context's identity model (ADR-0011).  At the
 * composition root the same underlying UUID is cast to both `ActorId`
 * (for RLS) and `UserId` (for domain data fields) from the same source.
 */
export type ActorId = Brand<string, 'ActorId'>;

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
/** Casts a raw string to a {@link UserId}. See {@link asShowId}. */
export const asUserId = (id: string): UserId => id as UserId;
/** Casts a raw string to a {@link DomainEventId}. See {@link asShowId}. */
export const asDomainEventId = (id: string): DomainEventId => id as DomainEventId;
/** Casts a raw string to an {@link EventTypeName}. See {@link asShowId}. */
export const asEventTypeName = (name: string): EventTypeName => name as EventTypeName;
/** Casts a raw string to an {@link ActorId}. See {@link asShowId}. */
export const asActorId = (id: string): ActorId => id as ActorId;
