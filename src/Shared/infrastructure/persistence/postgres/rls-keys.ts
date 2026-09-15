// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId, PrincipalId } from '../../../domain/domain-ids.js';
import type { TransactionScope } from '../../../domain/transaction-scope.js';
import { scopeToOwnerColumns } from './owner-columns.js';

/**
 * The pair of RLS session keys derived from a {@link TransactionScope}.
 *
 * A non-applicable key is `null` (not the empty string); an applicable key is
 * the scope's actual id, even when that id is `''` (the `asClubId`/
 * `asPrincipalId` factories are plain casts and accept `''`).  Nullability is
 * therefore a function of `scope.kind`, never of string truthiness, so an
 * applicable-but-empty id is preserved verbatim — the outbox writer binds it
 * and lets PostgreSQL reject it as an invalid UUID.
 *
 * The RLS session-variable setter consumes this with `?? ''` (the `set_config`
 * GUC needs text, and `nullif(current_setting(...), '')::uuid` collapses `''`
 * to `NULL`).
 *
 * The `principalId` field is the kernel's context-neutral actor id
 * (`PrincipalId`, ADR-0013). The SQL wire name stays `user_id` / `app.user_id`
 * (ADR-0005); only the TypeScript field is renamed.
 */
export interface RlsKeys {
    readonly clubId: ClubId | null;
    readonly principalId: PrincipalId | null;
}

/**
 * Maps a {@link TransactionScope} to its RLS key pair:
 *
 * - `club`      → both `clubId` and `principalId` are set.
 * - `exhibitor` → only `principalId` is set; `clubId` is `null`.
 * - `platform`  → both are `null` (no Club or user isolation).
 *
 * Delegates the nullability normalisation to the shared
 * {@link scopeToOwnerColumns} (also used by `pg-outbox-writer.ts`'s
 * `eventOwnerColumns`, from the event's own `EventScope`).
 *
 * Used by the RLS session-variable setter in `with-transaction.ts`. Internal
 * — not part of the kernel's public surface.
 */
export function scopeToRlsKeys(scope: TransactionScope): RlsKeys {
    return scopeToOwnerColumns(scope);
}
