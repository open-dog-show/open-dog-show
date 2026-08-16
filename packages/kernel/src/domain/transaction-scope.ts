// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TenantId, UserId } from './domain-ids.js';

/**
 * The identity carried into a unit-of-work transaction.
 *
 * Distinct from {@link EventScope}: `EventScope` describes _who owns a fact_
 * (written on the domain event / outbox row); `TransactionScope` describes
 * _who is acting_ so that the correct RLS session variables can be set.
 * See ADR-0005 — "Two distinct concepts, not one."
 *
 * - `tenant` — a Club admin acting on behalf of a Club: both `tenantId` and `userId` are set.
 * - `exhibitor` — a dog owner acting cross-tenant: only `userId` is set.
 * - `platform` — a platform operator acting globally: no tenant or account isolation.
 */
export type TransactionScope =
    | { readonly kind: 'tenant'; readonly tenantId: TenantId; readonly userId: UserId }
    | { readonly kind: 'exhibitor'; readonly userId: UserId }
    | { readonly kind: 'platform' };
