// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../../../domain/shared/domain-ids.js';
import { RoleGrant } from '../../../domain/model/role-grant/role-grant.js';
import type { RoleGrantRepository } from '../../../domain/model/role-grant/role-grant-repository.js';

export class FakeRoleGrantRepository implements RoleGrantRepository {
    private readonly store = new Map<UserId, RoleGrant[]>();

    async findByUser(userId: UserId): Promise<readonly RoleGrant[]> {
        // Return a fresh copy so callers cannot mutate the repository's internal
        // collection through the returned reference.
        return [...(this.store.get(userId) ?? [])];
    }

    async saveAll(userId: UserId, grants: readonly RoleGrant[]): Promise<void> {
        RoleGrant.assertOwnedBy(userId, grants);
        this.store.set(userId, [...grants]);
    }
}
