// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../domain/transaction-scope.js';

/**
 * The pair of RLS session keys derived from a {@link TransactionScope}.
 *
 * A non-applicable key is `null` (not the empty string); an applicable key is
 * the scope's actual id, even when that id is `''` (the `asTenantId`/
 * `asUserId` factories are plain casts and accept `''`).  Nullability is
 * therefore a function of `scope.kind`, never of string truthiness, so an
 * applicable-but-empty id is preserved verbatim — the outbox writer binds it
 * and lets PostgreSQL reject it as an invalid UUID, exactly as the
 * pre-refactor code did.
 *
 * The RLS session-variable setter consumes this with `?? ''` (the `set_config`
 * GUC needs text, and `nullif(current_setting(...), '')::uuid` collapses `''`
 * to `NULL`); the outbox writer binds the values directly — `null` for the
 * non-applicable `tenant_id` / `user_id` columns.
 */
export interface RlsKeys {
    readonly tenantId: string | null;
    readonly userId: string | null;
}

/**
 * Maps a {@link TransactionScope} to its RLS key pair, centralising the
 * nullability normalisation:
 *
 * - `tenant`    → both `tenantId` and `userId` are set.
 * - `exhibitor` → only `userId` is set; `tenantId` is `null`.
 * - `platform`  → both are `null` (no tenant or user isolation).
 *
 * Shared by the RLS session-variable setter (in `with-transaction.ts`) and the
 * outbox writer (in `pg-outbox-writer.ts`).  Internal — not part of the
 * kernel's public surface.
 */
export function scopeToRlsKeys(scope: TransactionScope): RlsKeys {
    switch (scope.kind) {
        case 'tenant':
            return { tenantId: scope.tenantId, userId: scope.userId };
        case 'exhibitor':
            return { tenantId: null, userId: scope.userId };
        case 'platform':
            return { tenantId: null, userId: null };
    }
}
