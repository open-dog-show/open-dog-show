// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TenantId, PrincipalId } from './domain-ids.js';

/**
 * The identity carried into a unit-of-work transaction.
 *
 * Distinct from {@link EventScope}: `EventScope` describes _who owns a fact_
 * (written on the domain event / outbox row); `TransactionScope` describes
 * _who is acting_ so that the correct RLS session variables can be set.
 * See ADR-0005 — "Two distinct concepts, not one." Per ADR-0013 the actor is a
 * context-neutral `PrincipalId` (the kernel's RLS-plumbing type), not IAM's
 * `UserId`; the SQL wire name `app.user_id` is unchanged.
 *
 * - `tenant` — a Club admin acting on behalf of a Club: both `tenantId` and `principalId` are set.
 * - `exhibitor` — a dog owner acting cross-tenant: only `principalId` is set.
 * - `platform` — a platform operator acting globally: no tenant or user isolation.
 */
export type TransactionScope =
    | { readonly kind: 'tenant'; readonly tenantId: TenantId; readonly principalId: PrincipalId }
    | { readonly kind: 'exhibitor'; readonly principalId: PrincipalId }
    | { readonly kind: 'platform' };
