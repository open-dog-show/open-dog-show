// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId, PrincipalId } from '../../../domain/domain-ids.js';
import { assertNever } from '../../../domain/assert-never.js';

/**
 * The `(clubId, principalId)` owner-column pair a `club`/`exhibitor`/
 * `platform` scope flattens to. A non-applicable column is `null`; an
 * applicable column carries the scope's id verbatim, even when that id is
 * `''` — see {@link scopeToOwnerColumns}.
 */
export interface OwnerColumns {
    readonly clubId: ClubId | null;
    readonly principalId: PrincipalId | null;
}

/**
 * A `club`/`exhibitor`/`platform` scope, shaped just enough to flatten to
 * {@link OwnerColumns} — structurally compatible with both `EventScope`
 * (whose `club` variant carries only `clubId`, ADR-0005) and
 * `TransactionScope` (whose `club` variant carries both `clubId` and
 * `principalId`), the two scope families this derivation serves.
 */
export type OwnerScopeLike =
    | { readonly kind: 'club'; readonly clubId: ClubId; readonly principalId?: PrincipalId }
    | { readonly kind: 'exhibitor'; readonly principalId: PrincipalId }
    | { readonly kind: 'platform' };

/**
 * Flattens a scope into its owner-column pair, centralising the nullability
 * normalisation that `pg-outbox-writer.ts`'s `eventOwnerColumns` (from an
 * event's own `EventScope`, ADR-0027) and `rls-keys.ts`'s `scopeToRlsKeys`
 * (from the acting `TransactionScope`) both need:
 *
 * - `club`      → `clubId` is always set; `principalId` is set only when the
 *                 scope itself carries one (`TransactionScope`'s `club`
 *                 variant does; `EventScope`'s never does, ADR-0005).
 * - `exhibitor` → only `principalId` is set; `clubId` is `null`.
 * - `platform`  → both are `null` (no Club or user isolation).
 *
 * Nullability is a function of `scope.kind` (and, for `club`, of which scope
 * family produced it), never of string truthiness, so an applicable-but-empty
 * id (`''`) is preserved verbatim rather than normalized to `null`.
 */
export function scopeToOwnerColumns(scope: OwnerScopeLike): OwnerColumns {
    switch (scope.kind) {
        case 'club':
            return { clubId: scope.clubId, principalId: scope.principalId ?? null };
        case 'exhibitor':
            return { clubId: null, principalId: scope.principalId };
        case 'platform':
            return { clubId: null, principalId: null };
        default:
            return assertNever(scope, 'scope kind');
    }
}
