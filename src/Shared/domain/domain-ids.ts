// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Brand } from './brand.js';

/**
 * Compile-time brand helper.
 *
 * A branded type is structurally identical to `T` at runtime but is
 * treated as a distinct type by the TypeScript compiler.  This prevents
 * accidental substitution of one ID kind for another (e.g. passing a
 * `PrincipalId` where a `ClubId` is expected).
 */

/** Branded string that uniquely identifies a kennel-club Club. */
export type ClubId = Brand<string, 'ClubId'>;
/**
 * Branded string naming the context-neutral "actor in a transaction."
 *
 * A `PrincipalId` is the abstract access-control principal on whose behalf a
 * unit of work runs — independent of which identity system produced it. The
 * kernel uses it solely for RLS plumbing: `TransactionScope` sets the
 * `app.user_id` session variable from it (ADR-0005 / ADR-0013). It is a kernel
 * plumbing type, intentionally absent from `CONTEXT.md` (like `ClubId`).
 *
 * In the current system a `PrincipalId` always carries a `User.id` (the value
 * is identical and `User → PrincipalId` is a cast, not a translation); a future
 * non-User principal would produce a `PrincipalId` through its own adapter
 * without the kernel changing.
 */
export type PrincipalId = Brand<string, 'PrincipalId'>;
/**
 * Branded string that uniquely identifies a single domain-event occurrence.
 *
 * Acts as the idempotency key for the outbox.  Structurally a plain string
 * (a UUID) at runtime; the brand prevents an `EventId` from being passed where
 * another branded id (e.g. `ClubId`) is expected.
 */
export type EventId = Brand<string, 'EventId'>;
/**
 * Branded string that uniquely identifies an aggregate root.
 *
 * The kernel emits domain events for many aggregate kinds (a Show, a Dog, an
 * Entry, …) and cannot know which context-specific brand an aggregate id
 * carries, so this is the **context-neutral** aggregate identifier brand.
 * Contexts may narrow it further at their own boundary (e.g. cast a context's
 * own id brand to an `AggregateId` when handing an event to the kernel).
 * Structurally a plain string at runtime; the brand prevents an `AggregateId`
 * from being passed where another branded id is expected.
 */
export type AggregateId = Brand<string, 'AggregateId'>;
// `EventType` / `asEventType` live in `domain-event-type.ts` — an event-type
// name is not an identifier brand (its constructor validates, unlike the plain
// `as*` casts here). Re-exported so existing `from './domain-ids.js'` imports
// keep working.
export type { EventType } from './domain-event-type.js';
export { asEventType } from './domain-event-type.js';

/**
 * Casts a raw string to a {@link ClubId}.
 *
 * These `as*` constructors are the **only** safe boundary-crossing points
 * where an untyped string (e.g. from a database row or HTTP request)
 * becomes a typed domain ID.  Prefer calling them at the outermost layer
 * (repository, controller) so the rest of the domain works exclusively
 * with typed IDs.
 */
export const asClubId = (id: string): ClubId => id as ClubId;
/**
 * Casts a raw string to a {@link PrincipalId}. See {@link asClubId}.
 *
 * Per ADR-0013: at the composition root an untyped actor id (e.g. a `User.id`
 * from the IAM context) is cast to the context-neutral {@link PrincipalId} the
 * kernel carries in `TransactionScope`. Plain cast — no validation — identical
 * in shape to {@link asClubId}.
 */
export const asPrincipalId = (id: string): PrincipalId => id as PrincipalId;
/**
 * Casts a raw string to an {@link EventId}. See {@link asClubId}.
 *
 * Use this at the boundary where an untyped event id (e.g. from a database
 * outbox row or a replayed event) becomes a typed {@link EventId}.
 */
export const asEventId = (id: string): EventId => id as EventId;
/**
 * Casts a raw string to an {@link AggregateId}. See {@link asClubId}.
 *
 * Use this at the boundary where an untyped aggregate id (e.g. from a database
 * row or HTTP request) becomes a typed {@link AggregateId}.  A context may
 * also widen its own narrower aggregate-id brand (e.g. `EntryId`) to an
 * `AggregateId` when handing an event to the kernel.
 */
export const asAggregateId = (id: string): AggregateId => id as AggregateId;
