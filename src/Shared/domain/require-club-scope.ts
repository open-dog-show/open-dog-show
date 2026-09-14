// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClubId } from './domain-ids.js';
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
