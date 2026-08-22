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
/** Branded string that uniquely identifies a user. */
export type UserId = Brand<string, 'UserId'>;
/**
 * Branded string that uniquely identifies a single domain-event occurrence.
 *
 * Acts as the idempotency key for the outbox.  Structurally a plain string
 * (a UUID) at runtime; the brand prevents an `EventId` from being passed where
 * another branded id (e.g. `ShowId`) is expected.
 */
export type EventId = Brand<string, 'EventId'>;
/**
 * Branded string naming a domain-event type, in `<context>.<PascalName>`
 * form (e.g. `'entries.EntrySubmitted'`).
 *
 * The brand distinguishes an event-type name from an arbitrary string so a
 * context name or aggregate id can never be silently substituted for an
 * event type.  Unlike the identifier brands, an `EventType` is **only**
 * obtainable through {@link asEventType}, which validates the format.
 */
export type EventType = Brand<string, 'EventType'>;

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
/**
 * Casts a raw string to an {@link EventId}. See {@link asShowId}.
 *
 * Use this at the boundary where an untyped event id (e.g. from a database
 * outbox row or a replayed event) becomes a typed {@link EventId}.
 */
export const asEventId = (id: string): EventId => id as EventId;

/**
 * Matches the {@link EventType} format: a lowercase `<context>` word, a dot,
 * then a `<PascalName>` word (e.g. `entries.EntrySubmitted`).
 */
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*\.[A-Z][a-zA-Z0-9]*(?![\s\S])/;

/**
 * Casts a raw string to an {@link EventType}, **validating** it is in
 * `<context>.<PascalName>` form (e.g. `'entries.EntrySubmitted'`).
 *
 * `EventType` is the one branded id whose constructor is a validating factory
 * rather than a plain cast: an invalid event-type name must never reach the
 * outbox, so malformed values are rejected at the boundary instead of being
 * silently branded.  Use this wherever an event type enters the domain — in
 * `createDomainEvent` callers, and in `decodeDomainEvent` when restoring an
 * event from its JSON / database form.
 *
 * @throws {TypeError} when `value` does not match `<word>.<PascalWord>`.
 */
export const asEventType = (value: string): EventType => {
    if (!EVENT_TYPE_PATTERN.test(value)) {
        throw new TypeError(
            `Invalid EventType '${value}': expected '<context>.<PascalName>' (e.g. 'entries.EntrySubmitted').`,
        );
    }
    return value as EventType;
};
