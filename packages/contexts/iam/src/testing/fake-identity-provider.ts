// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IdentityProvider, ProviderClaims } from '../domain/identity-provider.js';

/**
 * In-memory {@link IdentityProvider} for unit tests and downstream context
 * tests.
 *
 * Seeded at construction with a fixed `Map<token, ProviderClaims>`. Unknown
 * tokens are rejected with an error, mirroring a real provider's invalid-token
 * failure so tests exercise the authentication flow without a real provider or
 * database.
 */
export class FakeIdentityProvider implements IdentityProvider {
    private readonly tokens: ReadonlyMap<string, ProviderClaims>;

    constructor(tokens: ReadonlyMap<string, ProviderClaims>) {
        this.tokens = tokens;
    }

    async resolve(token: string): Promise<ProviderClaims> {
        const claims = this.tokens.get(token);
        if (claims === undefined) {
            throw new Error(`FakeIdentityProvider: unknown token '${token}'`);
        }
        return claims;
    }
}
