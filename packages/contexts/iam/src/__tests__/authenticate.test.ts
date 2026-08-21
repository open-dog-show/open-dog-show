// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asUserId } from '@ods/kernel';
import type { User } from '../domain/user.js';
import { authenticate } from '../domain/authenticate.js';
import { UserSuspendedError } from '../domain/user-suspended-error.js';
import { FakeUserRepository } from '../testing/fake-user-repository.js';
import { FakeIdentityProvider } from '../testing/fake-identity-provider.js';

const TOKEN_ALICE = 'token-alice';
const TOKEN_BOB = 'token-bob';

const CLAIMS_ALICE = {
    sub: 'sub|alice',
    displayName: 'Alice Original',
    email: 'alice@example.com',
};
const CLAIMS_ALICE_UPDATED = {
    sub: 'sub|alice',
    displayName: 'Alice Updated',
    email: 'alice-new@example.com',
};

describe('authenticate', () => {
    let userRepo: FakeUserRepository;
    let idProvider: FakeIdentityProvider;
    let fakeIdGenerator: { generate: () => string };

    beforeEach(() => {
        let idCounter = 0;
        fakeIdGenerator = { generate: () => `user-${++idCounter}` };
        userRepo = new FakeUserRepository();
        idProvider = new FakeIdentityProvider(
            new Map([
                [TOKEN_ALICE, CLAIMS_ALICE],
                [TOKEN_BOB, { sub: 'sub|bob', displayName: 'Bob', email: 'bob@example.com' }],
            ]),
        );
    });

    it('first login creates an Active User with claims as display name and email', async () => {
        const user = await authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator);

        expect(user.status).toBe('Active');
        expect(user.displayName).toBe(CLAIMS_ALICE.displayName);
        expect(user.email).toBe(CLAIMS_ALICE.email);
        expect(user.externalSubject).toBe(CLAIMS_ALICE.sub);
    });

    it('first login saves the user to the repository', async () => {
        const user = await authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator);

        const found = await userRepo.findById(user.id);
        expect(found).toEqual(user);
    });

    it('second login refreshes display name and email on the existing User', async () => {
        await authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator);

        idProvider = new FakeIdentityProvider(new Map([[TOKEN_ALICE, CLAIMS_ALICE_UPDATED]]));
        const updated = await authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator);

        expect(updated.displayName).toBe(CLAIMS_ALICE_UPDATED.displayName);
        expect(updated.email).toBe(CLAIMS_ALICE_UPDATED.email);
    });

    it('second login does not create a second user', async () => {
        const first = await authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator);
        idProvider = new FakeIdentityProvider(new Map([[TOKEN_ALICE, CLAIMS_ALICE_UPDATED]]));
        const second = await authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator);

        expect(second.id).toBe(first.id);
    });

    it('throws UserSuspendedError when the resolved User is Suspended', async () => {
        const suspended: User = {
            id: asUserId('user-suspended'),
            displayName: 'Alice',
            email: 'alice@example.com',
            status: 'Suspended',
            externalSubject: CLAIMS_ALICE.sub,
        };
        await userRepo.save(suspended);

        await expect(
            authenticate(TOKEN_ALICE, idProvider, userRepo, fakeIdGenerator),
        ).rejects.toThrow(UserSuspendedError);
    });
});
