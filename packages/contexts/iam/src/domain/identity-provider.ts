// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Raw identity-provider claims resolved from an external token.
 *
 * `sub` is the opaque, stable external subject identifier the provider uses to
 * name the same person across logins; `displayName` and `email` are the profile
 * facts refreshed on every login.
 *
 * These are **raw** claims — `resolve` returns exactly what the provider sent,
 * un-normalized. Canonicalization (trim+lowercase of `email`, trim of
 * `displayName`, blank-`sub`/`email` rejection, the refresh keep-existing
 * guard) is an invariant of the {@link User} aggregate, enforced in
 * `createUser` / `refreshUserProfile` (ADR-0015) — so a `User` produced by
 * those operations is canonical. Other construction paths (repository
 * rehydration, test fixtures) must preserve the invariant themselves. The
 * ACL adapter and {@link authenticate} consume these raw claims and hand
 * them to the aggregate; the domain layer never reaches past the
 * {@link IdentityProvider} port to a concrete provider (ADR-0011).
 */
export interface ProviderClaims {
    readonly sub: string;
    readonly displayName: string;
    readonly email: string;
}

/**
 * Anti-corruption port to an external identity provider (ADR-0011).
 *
 * The generic Identity & Access context stays behind this port: it never names
 * a concrete provider (OIDC, SAML, …) in its domain layer. `resolve` accepts an
 * opaque external token and returns the provider's **raw** claims (see
 * {@link ProviderClaims}), or throws when the token is invalid or unknown — the
 * caller surfaces that as an authentication failure. Canonicalization of those
 * claims is owned by the {@link User} aggregate, not by this port (ADR-0015).
 */
export interface IdentityProvider {
    resolve(token: string): Promise<ProviderClaims>;
}
