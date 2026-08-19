// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '@ods/kernel';
import type { RoleGrant } from './role-grant.js';

export interface RoleGrantRepository {
    findByUser(userId: UserId): Promise<readonly RoleGrant[]>;
    /** Replaces all grants for the user with the supplied collection. */
    saveAll(userId: UserId, grants: readonly RoleGrant[]): Promise<void>;
}
