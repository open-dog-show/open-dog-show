// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Raw identity-provider claims resolved from an external token.
 *
 * `sub` is the opaque, stable external subject identifier the provider uses to
 * name the same person across logins; `displayName` and `email` are the profile
 * facts refreshed on every login. The ACL adapter (and {@link authenticate})
 * is the only place these raw claims are consumed — the domain layer never
 * reaches past the {@link IdentityProvider} port to a concrete provider.
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
 * opaque external token and returns the provider's claims, or throws when the
 * token is invalid or unknown — the caller surfaces that as an authentication
 * failure.
 */
export interface IdentityProvider {
    resolve(token: string): Promise<ProviderClaims>;
}
