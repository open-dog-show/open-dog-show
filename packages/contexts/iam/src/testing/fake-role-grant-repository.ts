// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../domain/domain-ids.js';
import { type RoleGrant, assertGrantsOwnedBy } from '../domain/role-grant.js';
import type { RoleGrantRepository } from '../domain/role-grant-repository.js';

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
