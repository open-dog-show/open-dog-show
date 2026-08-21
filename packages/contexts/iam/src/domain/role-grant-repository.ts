// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '@ods/kernel';
import type { RoleGrant } from './role-grant.js';

export interface RoleGrantRepository {
    findByUser(userId: UserId): Promise<readonly RoleGrant[]>;
    /**
     * Replaces all grants for `userId`.
     * Throws `RoleGrantOwnerMismatchError` if any grant's `userId` !== `userId`.
     */
    saveAll(userId: UserId, grants: readonly RoleGrant[]): Promise<void>;
}
