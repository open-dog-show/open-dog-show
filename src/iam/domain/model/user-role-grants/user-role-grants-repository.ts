// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../../shared/domain-ids.js';
import type { UserRoleGrants } from './user-role-grants.js';

/**
 * Persistence port for the `UserRoleGrants` aggregate (ADR-0026).
 *
 * `findByUser` never returns an absent value (N1) — a user with no grants
 * yet gets back `UserRoleGrants.empty(userId)` (version `0`), so a caller
 * always has a root to grant/revoke onto. `add` persists a root for the
 * first time (from version `0`); `update` checks the aggregate's `version`
 * and throws `ConcurrentModificationError`
 * (`../../shared/concurrent-modification-error.js`) on a mismatch — two
 * concurrent stale updates race, and the second write loses rather than
 * silently dropping the first writer's grant/revoke (the "lost revoke"
 * scenario).
 */
export interface UserRoleGrantsRepository {
    findByUser(userId: UserId): Promise<UserRoleGrants>;
    /**
     * @throws {ConcurrentModificationError} when a root for this user already
     *   exists — reusing the same error `User.add`'s `DuplicateExternalSubjectError`
     *   is the sibling of, not an alias for it: `add`'s caller expects *no*
     *   row yet, which is itself a version claim (an implicit "version 0"),
     *   so a row already existing is the same optimistic-concurrency fault
     *   family as a stale `update`, not a distinct one. Unlike
     *   `DuplicateExternalSubjectError`, nothing today catches this and
     *   retries through a re-read (no grant/revoke use case exists yet) —
     *   revisit if one needs that recovery path.
     */
    add(roleGrants: UserRoleGrants): Promise<void>;
    /** @throws {ConcurrentModificationError} when the stored version no longer matches `roleGrants.version`. */
    update(roleGrants: UserRoleGrants): Promise<void>;
}
