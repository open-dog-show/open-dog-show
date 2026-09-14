// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

// Published contract only (ADR-0028): command/response/errors, the
// IdentityQuery read model, event classes/payloads, and one composition-root
// wiring factory. `User`, `UserRoleGrants`, repositories, ports and fakes
// stay internal — tests reach them via deep paths (`tests/` is not a
// context, so the boundary rule below does not govern its imports).
export {
    AuthenticateHandler,
    type AuthenticateCommand,
    type AuthenticateResponse,
    type AuthenticateError,
    UserSuspendedError,
    InvalidProviderClaimsError,
} from './application/authenticate/authenticate.js';
export {
    IdentityQuery,
    type IdentitySnapshot,
} from './application/identity-query/identity-query.js';
export type { DomainRole } from './domain/model/role-grant/role-grant.js';
export {
    RoleGranted,
    ROLE_GRANTED_TYPE,
    type RoleGrantedPayload,
} from './domain/model/user-role-grants/events/role-granted.js';
export {
    RoleRevoked,
    ROLE_REVOKED_TYPE,
    type RoleRevokedPayload,
} from './domain/model/user-role-grants/events/role-revoked.js';
export {
    createIamContext,
    type IamContext,
    type IamContextDependencies,
} from './infrastructure/di/create-iam-context.js';
