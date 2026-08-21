// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IdentityClaims, IdentityProvider } from '../domain/identity-provider.js';

export class FakeIdentityProvider implements IdentityProvider {
    constructor(private readonly tokens: Map<string, IdentityClaims>) {}

    async resolve(token: string): Promise<IdentityClaims> {
        const claims = this.tokens.get(token);
        if (claims === undefined) {
            throw new Error(`FakeIdentityProvider: unknown token "${token}"`);
        }
        return claims;
    }
}
