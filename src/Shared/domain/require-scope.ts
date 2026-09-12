// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId, PrincipalId } from './domain-ids.js';
import type { TransactionScope } from './transaction-scope.js';
import { ScopeMismatchError } from './scope-mismatch-error.js';

/**
 * Narrows `scope` to its owning {@link ClubId}, for use cases whose aggregate
 * is Club-owned outright (not hybrid).
 *
 * @throws {ScopeMismatchError} when `scope` is not a `club` scope.
 */
export function requireClubScope(scope: TransactionScope): ClubId {
    if (scope.kind !== 'club') {
        throw new ScopeMismatchError('club', scope.kind);
    }
    return scope.clubId;
}

/**
 * Narrows `scope` to the acting {@link PrincipalId} — the actor for either a
 * `club` or an `exhibitor` scope. Use this where the aggregate's owning Club
 * comes from elsewhere (e.g. a hybrid aggregate whose Club is the input's
 * parent, per ADR-0026) and only the acting principal is needed from the
 * scope.
 *
 * @throws {ScopeMismatchError} when `scope` is a `platform` scope (no
 *   principal to attribute the action to).
 */
export function requireActor(scope: TransactionScope): PrincipalId {
    switch (scope.kind) {
        case 'club':
        case 'exhibitor':
            return scope.principalId;
        case 'platform':
            throw new ScopeMismatchError('club or exhibitor', scope.kind);
    }
}
