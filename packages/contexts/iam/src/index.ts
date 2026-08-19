// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { User, UserStatus } from './domain/user.js';
export { suspendUser, reactivateUser } from './domain/user.js';
export type { UserRepository } from './domain/user-repository.js';
export type { DomainRole, RoleScope, RoleGrant } from './domain/role-grant.js';
export { grantRole, revokeRoleGrant, hasRoleGrant, DuplicateRoleGrantError } from './domain/role-grant.js';
export type { RoleGrantRepository } from './domain/role-grant-repository.js';
