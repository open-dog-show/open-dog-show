// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type { UserId } from './domain/domain-ids.js';
export { asUserId } from './domain/domain-ids.js';
export type { User, UserStatus } from './domain/user.js';
export {
    suspendUser,
    reactivateUser,
    createUser,
    refreshUserProfile,
    InvalidProviderClaimsError,
} from './domain/user.js';
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
export type { IdentityProvider, ProviderClaims } from './domain/identity-provider.js';
export type { UserIdGenerator } from './domain/user-id-generator.js';
export { authenticate, type AuthenticateDeps, UserSuspendedError } from './domain/authenticate.js';
// In-memory test double exported on the public surface so downstream context
// tests can exercise the authentication flow without a real provider (issue #80).
export { FakeIdentityProvider } from './testing/fake-identity-provider.js';
