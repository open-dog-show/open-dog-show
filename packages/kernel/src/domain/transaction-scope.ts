// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TenantId, ActorId } from './domain-ids.js';

/**
 * The data-ownership scope carried into a unit-of-work transaction — see
 * `CONTEXT.md` **Data-Ownership Scope** and ADR-0005.
 *
 * Distinct from {@link EventScope}: `EventScope` describes _who owns a recorded
 * fact_; `TransactionScope` describes _who is acting_ so that the correct RLS
 * session variables can be set.
 *
 * `actorId` is a context-neutral {@link ActorId} rather than a `UserId` so
 * the RLS mechanism does not couple every context to the IAM identity model
 * (ADR-0011).  The composition root casts the authenticated user's ID to
 * `ActorId` before opening a transaction.
 *
 * - `tenant`   — a Club admin acting on behalf of a Club: `tenantId` + `actorId`.
 * - `exhibitor` — an Exhibitor acting cross-tenant: `actorId` only.
 * - `platform` — a platform operator acting globally: no isolation keys.
 */
export type TransactionScope =
    | { readonly kind: 'tenant'; readonly tenantId: TenantId; readonly actorId: ActorId }
    | { readonly kind: 'exhibitor'; readonly actorId: ActorId }
    | { readonly kind: 'platform' };
