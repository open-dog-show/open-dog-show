// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../domain/transaction-scope.js';

/**
 * The pair of RLS session keys derived from a {@link TransactionScope}.
 *
 * Both keys are always present; a non-applicable key is the **empty string**
 * (not `null`).  This is the form the RLS session-variable setter needs, because
 * `set_config(setting, value, true)` stores text and the RLS policies read via
 * `nullif(current_setting(...), '')::uuid` — an empty string safely collapses
 * to `NULL` so the `::uuid` cast never fails and no rows match the predicate.
 * The outbox writer reuses this same mapping and flattens the empty strings to
 * `NULL` for the nullable `tenant_id` / `user_id` columns.
 */
export interface RlsKeys {
    readonly tenantId: string;
    readonly userId: string;
}

/**
 * Maps a {@link TransactionScope} to its RLS key pair, centralising the
 * null/empty-string normalisation:
 *
 * - `tenant`    → both `tenantId` and `userId` are set.
 * - `exhibitor` → only `userId` is set; `tenantId` is `''`.
 * - `platform`  → both are `''` (no tenant or user isolation).
 *
 * Shared by the RLS session-variable setter (in `with-transaction.ts`) and the
 * outbox writer's column flattening (in `pg-outbox-writer.ts`).  Internal — not
 * part of the kernel's public surface.
 */
export function scopeToRlsKeys(scope: TransactionScope): RlsKeys {
    switch (scope.kind) {
        case 'tenant':
            return { tenantId: scope.tenantId, userId: scope.userId };
        case 'exhibitor':
            return { tenantId: '', userId: scope.userId };
        case 'platform':
            return { tenantId: '', userId: '' };
    }
}
