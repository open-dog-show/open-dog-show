// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    type User,
    createUser,
    refreshUserProfile,
    assertCanAuthenticate,
} from '../../domain/model/user/user.js';
// Re-exported so callers (`from './authenticate.js'`) still see the error; the
// canonical definition lives with the `User` aggregate, next to the suspension
// rule it signals.
export { UserSuspendedError } from '../../domain/model/user/user.js';
import type { UserRepository } from '../../domain/model/user/user-repository.js';
import type { IdentityProvider } from '../../domain/model/user/identity-provider.js';
import type { UserIdGenerator } from '../../domain/model/user/user-id-generator.js';

/**
 * The collaborators {@link authenticate} orchestrates. Each is a domain port, so
 * the operation is unit-testable with in-memory fakes and no real provider or
 * database.
 */
export interface AuthenticateDeps {
    /** Anti-corruption port to the external identity provider. */
    readonly identityProvider: IdentityProvider;
    /** The user aggregate repository (lookup + save). */
    readonly users: UserRepository;
    /** Mints a new {@link UserId} for a first-time user. */
    readonly userIdGenerator: UserIdGenerator;
}

/**
 * Authenticate the bearer of `token` against the identity provider and return
 * the resulting {@link User}.
 *
 * - **First login** (unknown `sub`): a new `Active` user is created from the
 *   provider claims and persisted atomically via
 *   `UserRepository.createIfAbsent`, which returns the existing account on a
 *   concurrent-create conflict (so two simultaneous first logins for one `sub`
 *   cannot mint two platform accounts).
 * - **Subsequent login** (known `sub`, `Active`): `displayName` and `email`
 *   are refreshed from the latest claims and only those profile facts are
 *   persisted (via `UserRepository.saveProfileFacts`), so a concurrent
 *   suspension between the read and the write is never clobbered.
 * - **Suspended user**: throws {@link UserSuspendedError} before any other
 *   processing — the suspended account is left untouched. The check is the
 *   aggregate-owned {@link assertCanAuthenticate}, used in both the first-login
 *   and returning-login paths so the rule lives in one place.
 * - **Invalid provider claims**: {@link createUser} throws
 *   {@link InvalidProviderClaimsError} on a blank `sub` or `email` on first
 *   login; `authenticate` does not catch it — it propagates exactly as
 *   `UserSuspendedError` does, so no account is created. A future composition
 *   root / API boundary will map it to an authentication failure (ADR-0015).
 *
 * The platform `UserId` is intentionally distinct from the provider `sub`
 * (ADR-0013); a new id is minted by the {@link UserIdGenerator} on first login.
 */
export async function authenticate(deps: AuthenticateDeps, token: string): Promise<User> {
    const claims = await deps.identityProvider.resolve(token);
    const existing = await deps.users.findByExternalSubject(claims.sub);

    if (existing === undefined) {
        // First login: atomic create-or-return-existing so two concurrent logins
        // for the same `sub` cannot mint two platform accounts.
        const candidate = createUser(deps.userIdGenerator.generate(), claims.sub, claims);
        const persisted = await deps.users.createIfAbsent(candidate);
        // A concurrent request may have created the winning account and an admin
        // then suspended it between our lookup and createIfAbsent; re-check the
        // returned user before authenticating, mirroring the existing-user path.
        assertCanAuthenticate(persisted);
        return persisted;
    }

    // Known account: a Suspended user cannot authenticate — reject before any
    // profile refresh or save so the suspended record is left untouched.
    assertCanAuthenticate(existing);

    // Known Active account: refresh the profile facts from the latest claims.
    // refreshUserProfile preserves the stable id, external subject, and status.
    const refreshed = refreshUserProfile(existing, claims);
    // Persist only the profile columns, not the whole aggregate. If an admin
    // suspends this account between the read above and the write, a full
    // `save` would clobber `status` back to `Active` (a lost update);
    // `saveProfileFacts` writes only `displayName`/`email`, preserving the
    // concurrent suspension.
    await deps.users.saveProfileFacts(refreshed);
    return refreshed;
}
