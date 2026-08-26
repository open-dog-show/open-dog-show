// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { UserId } from './domain/domain-ids.js';
export { asUserId } from './domain/domain-ids.js';
export type { User, UserStatus } from './domain/user.js';
export { suspendUser, reactivateUser } from './domain/user.js';
export type { UserRepository } from './domain/user-repository.js';
export type {
    DomainRole,
    ClubScope,
    PlatformScope,
    RoleScope,
    RoleGrant,
    RoleGrantKey,
} from './domain/role-grant.js';
export {
    grantRole,
    revokeRoleGrant,
    hasRoleGrant,
    DuplicateRoleGrantError,
    RoleGrantOwnerMismatchError,
} from './domain/role-grant.js';
export type { RoleGrantRepository } from './domain/role-grant-repository.js';
