// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asUserId } from '../domain/domain-ids.js';
import type { User } from '../domain/user.js';
import type { UserRepository } from '../domain/user-repository.js';
import { authenticate, type AuthenticateDeps, UserSuspendedError } from '../domain/authenticate.js';
import { FakeIdentityProvider, FakeUserRepository, FakeUserIdGenerator } from '../testing/index.js';

const ALICE_TOKEN = 'token-alice';
const ALICE_CLAIMS = { sub: 'sub|alice', displayName: 'Alice', email: 'alice@example.com' };

function deps(tokens = new Map([[ALICE_TOKEN, ALICE_CLAIMS]])): AuthenticateDeps {
    return {
        identityProvider: new FakeIdentityProvider(tokens),
        users: new FakeUserRepository(),
        userIdGenerator: new FakeUserIdGenerator(),
    };
}

describe('authenticate', () => {
    it('first login for an unknown sub creates an Active user saved via the UserRepository', async () => {
        const d = deps();

        const user = await authenticate(d, ALICE_TOKEN);

        expect(user.status).toBe('Active');
        expect(user.externalSubject).toBe('sub|alice');
        expect(user.displayName).toBe('Alice');
        expect(user.email).toBe('alice@example.com');
        // The new user is persisted.
        const stored = await d.users.findByExternalSubject('sub|alice');
        expect(stored).toEqual(user);
    });

    it('subsequent login for a known sub refreshes displayName and email from the latest claims', async () => {
        // Second login: same `sub`, refreshed profile facts, delivered under a
        // different token (the provider returns fresh claims on each login).
        const REFRESHED_CLAIMS = {
            sub: 'sub|alice',
            displayName: 'Alice Smith',
            email: 'alice.smith@example.com',
        };
        const d = deps(
            new Map([
                [ALICE_TOKEN, ALICE_CLAIMS],
                ['token-alice-2', REFRESHED_CLAIMS],
            ]),
        );

        const first = await authenticate(d, ALICE_TOKEN);
        const second = await authenticate(d, 'token-alice-2');

        // Same platform account — id and external subject are stable.
        expect(second.id).toBe(first.id);
        expect(second.externalSubject).toBe('sub|alice');
        // Profile facts are refreshed.
        expect(second.displayName).toBe('Alice Smith');
        expect(second.email).toBe('alice.smith@example.com');
        expect(second.status).toBe('Active');
        // The refreshed user is persisted, overwriting the first-login record.
        const stored = await d.users.findByExternalSubject('sub|alice');
        expect(stored).toEqual(second);
    });

    it('throws UserSuspendedError for a known Suspended user before any profile refresh', async () => {
        const BOB_TOKEN = 'token-bob';
        const d = deps(
            new Map([
                [
                    BOB_TOKEN,
                    { sub: 'sub|bob', displayName: 'Bob Smith', email: 'bob.smith@example.com' },
                ],
            ]),
        );
        // Pre-seed a Suspended account for the same `sub`.
        const suspendedBob: User = {
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: 'bob@example.com',
            status: 'Suspended',
            externalSubject: 'sub|bob',
        };
        await d.users.save(suspendedBob);

        await expect(authenticate(d, BOB_TOKEN)).rejects.toBeInstanceOf(UserSuspendedError);

        // No other processing: the suspended account is left untouched (the
        // provider's refreshed claims were never written).
        const stored = await d.users.findByExternalSubject('sub|bob');
        expect(stored).toEqual(suspendedBob);
    });

    it('two concurrent first logins for the same sub yield a single account', async () => {
        const d = deps(
            new Map([
                ['token-a', { sub: 'sub|shared', displayName: 'A', email: 'a@x.com' }],
                ['token-b', { sub: 'sub|shared', displayName: 'B', email: 'b@x.com' }],
            ]),
        );

        const [u1, u2] = await Promise.all([
            authenticate(d, 'token-a'),
            authenticate(d, 'token-b'),
        ]);

        // Both calls resolve to the same account — no duplicate platform account.
        expect(u1.id).toBe(u2.id);
        const stored = await d.users.findByExternalSubject('sub|shared');
        expect(stored).toEqual(u1);
        // The loser's candidate id was never persisted.
        expect(await d.users.findById(asUserId('user-2'))).toBeUndefined();
    });

    it('throws UserSuspendedError when createIfAbsent returns a concurrently-suspended winner', async () => {
        const suspendedWinner: User = {
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: 'bob@example.com',
            status: 'Suspended',
            externalSubject: 'sub|bob',
        };
        // Simulate the race: our lookup missed the account, but createIfAbsent
        // hands back a concurrently-created-and-suspended winner.
        const racedUsers: UserRepository = {
            findById: async () => undefined,
            findByExternalSubject: async () => undefined,
            save: async () => {},
            createIfAbsent: async () => suspendedWinner,
        };
        const d: AuthenticateDeps = {
            identityProvider: new FakeIdentityProvider(
                new Map([
                    [
                        'token-bob',
                        {
                            sub: 'sub|bob',
                            displayName: 'Bob Smith',
                            email: 'bob.smith@example.com',
                        },
                    ],
                ]),
            ),
            users: racedUsers,
            userIdGenerator: new FakeUserIdGenerator(),
        };

        await expect(authenticate(d, 'token-bob')).rejects.toBeInstanceOf(UserSuspendedError);
    });
});

// ---------------------------------------------------------------------------
// FakeIdentityProvider contract (exported for downstream context tests)
// ---------------------------------------------------------------------------

describe('FakeIdentityProvider', () => {
    it('returns the seeded claims for a known token', async () => {
        const provider = new FakeIdentityProvider(new Map([[ALICE_TOKEN, ALICE_CLAIMS]]));

        const claims = await provider.resolve(ALICE_TOKEN);

        expect(claims).toEqual(ALICE_CLAIMS);
    });

    it('rejects an unknown token', async () => {
        const provider = new FakeIdentityProvider(new Map([[ALICE_TOKEN, ALICE_CLAIMS]]));

        await expect(provider.resolve('token-nobody')).rejects.toThrow(/unknown token/);
    });
});
