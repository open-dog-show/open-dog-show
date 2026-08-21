// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export interface IdentityClaims {
    readonly sub: string;
    readonly displayName: string;
    readonly email: string;
}

export interface IdentityProvider {
    resolve(token: string): Promise<IdentityClaims>;
}
