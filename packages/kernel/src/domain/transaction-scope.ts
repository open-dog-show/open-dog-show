// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TenantId, UserId } from './domain-ids.js';

/**
 * The data-ownership scope carried into a unit-of-work transaction — see
 * `CONTEXT.md` **Data-Ownership Scope** and ADR-0005.
 *
 * Distinct from {@link EventScope}: `EventScope` describes _who owns a recorded
 * fact_; `TransactionScope` describes _who is acting_ so that the correct RLS
 * session variables can be set.
 *
 * - `tenant`   — a Club admin acting on behalf of a Club: `tenantId` + `userId`.
 * - `exhibitor` — an Exhibitor acting cross-tenant: `userId` only.
 * - `platform` — a platform operator acting globally: no isolation keys.
 */
export type TransactionScope =
    | { readonly kind: 'tenant'; readonly tenantId: TenantId; readonly userId: UserId }
    | { readonly kind: 'exhibitor'; readonly userId: UserId }
    | { readonly kind: 'platform' };
