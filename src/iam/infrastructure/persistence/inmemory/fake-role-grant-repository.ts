// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../../../domain/shared/domain-ids.js';
import {
    type RoleGrant,
    assertGrantsOwnedBy,
} from '../../../domain/model/role-grant/role-grant.js';
import type { RoleGrantRepository } from '../../../domain/model/role-grant/role-grant-repository.js';

export class FakeRoleGrantRepository implements RoleGrantRepository {
    private readonly store = new Map<UserId, RoleGrant[]>();

    async findByUser(userId: UserId): Promise<readonly RoleGrant[]> {
        return this.store.get(userId) ?? [];
    }

    async saveAll(userId: UserId, grants: readonly RoleGrant[]): Promise<void> {
        assertGrantsOwnedBy(userId, grants);
        this.store.set(userId, [...grants]);
    }
}
