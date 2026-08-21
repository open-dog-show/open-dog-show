// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IdGenerator } from '@ods/kernel';
import { asUserId } from '@ods/kernel';
import type { User } from './user.js';
import type { UserRepository } from './user-repository.js';
import type { IdentityProvider } from './identity-provider.js';
import { UserSuspendedError } from './user-suspended-error.js';

export async function authenticate(
    token: string,
    identityProvider: IdentityProvider,
    userRepository: UserRepository,
    idGenerator: IdGenerator,
): Promise<User> {
    const claims = await identityProvider.resolve(token);
    const existing = await userRepository.findByExternalSubject(claims.sub);

    if (existing !== undefined) {
        if (existing.status === 'Suspended') {
            throw new UserSuspendedError(existing);
        }
        const refreshed: User = { ...existing, displayName: claims.displayName, email: claims.email };
        await userRepository.save(refreshed);
        return refreshed;
    }

    const user: User = {
        id: asUserId(idGenerator.generate()),
        displayName: claims.displayName,
        email: claims.email,
        status: 'Active',
        externalSubject: claims.sub,
    };
    await userRepository.save(user);
    return user;
}
