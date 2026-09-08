// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { UserId } from './domain/shared/domain-ids.js';
export { asUserId } from './domain/shared/domain-ids.js';
export type { User, UserStatus } from './domain/model/user/user.js';
export {
    suspendUser,
    reactivateUser,
    createUser,
    refreshUserProfile,
    InvalidProviderClaimsError,
} from './domain/model/user/user.js';
export type { UserRepository } from './domain/model/user/user-repository.js';
export type {
    DomainRole,
    ClubScope,
    PlatformScope,
    RoleScope,
    RoleGrant,
    RoleGrantKey,
} from './domain/model/role-grant/role-grant.js';
export {
    grantRole,
    revokeRoleGrant,
    hasRoleGrant,
    DuplicateRoleGrantError,
    RoleGrantOwnerMismatchError,
} from './domain/model/role-grant/role-grant.js';
export type { RoleGrantRepository } from './domain/model/role-grant/role-grant-repository.js';
export type { IdentityProvider, ProviderClaims } from './domain/model/user/identity-provider.js';
export type { UserIdGenerator } from './domain/model/user/user-id-generator.js';
export {
    authenticate,
    type AuthenticateDeps,
    UserSuspendedError,
} from './domain/service/authenticate.js';
// In-memory test double exported on the public surface so downstream context
// tests can exercise the authentication flow without a real provider (issue #80).
export { FakeIdentityProvider } from './infrastructure/persistence/inmemory/fake-identity-provider.js';
