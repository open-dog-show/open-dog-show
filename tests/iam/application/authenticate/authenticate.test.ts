// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    asUserId,
    asEmailAddress,
    asExternalSubject,
} from '../../../../src/iam/domain/shared/domain-ids.js';
import { User, InvalidProviderClaimsError } from '../../../../src/iam/domain/model/user/user.js';
import type { UserRepository } from '../../../../src/iam/domain/model/user/user-repository.js';
import {
    authenticate,
    type AuthenticateDeps,
    type AuthenticateError,
    type AuthenticateResult,
    UserSuspendedError,
} from '../../../../src/iam/application/authenticate/authenticate.js';
import {
    FakeIdentityProvider,
    FakeUserRepository,
    FakeUserIdGenerator,
} from '../../../../src/iam/infrastructure/persistence/inmemory/index.js';

const ALICE_TOKEN = 'token-alice';
const ALICE_CLAIMS = { sub: 'sub|alice', displayName: 'Alice', email: 'alice@example.com' };

function deps(tokens = new Map([[ALICE_TOKEN, ALICE_CLAIMS]])): AuthenticateDeps {
    return {
        identityProvider: new FakeIdentityProvider(tokens),
        users: new FakeUserRepository(),
        userIdGenerator: new FakeUserIdGenerator(),
    };
}

// Narrowing helpers so each test reads the Result without repeating the ok/error branch (E1).
function userOf(result: AuthenticateResult): User {
    if (!result.ok) throw new Error(`expected an ok result but got ${result.error.name}`);
    return result.value;
}
function errorOf(result: AuthenticateResult): AuthenticateError {
    if (result.ok) throw new Error('expected an error result but got ok');
    return result.error;
}

describe('authenticate', () => {
    it('first login for an unknown sub creates an Active user saved via the UserRepository', async () => {
        const d = deps();

        const user = userOf(await authenticate(d, ALICE_TOKEN));

        expect(user.status).toBe('Active');
        expect(user.externalSubject).toBe('sub|alice');
        expect(user.displayName).toBe('Alice');
        expect(user.email).toBe('alice@example.com');
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

        const first = userOf(await authenticate(d, ALICE_TOKEN));
        const second = userOf(await authenticate(d, 'token-alice-2'));

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

    it('does not clobber a concurrent suspension when refreshing a returning user (lost-update guard)', async () => {
        // Seed an Active user via first login, then refresh it under a repo
        // that suspends the stored account *inside* saveProfileFacts —
        // simulating an admin suspending the account between authenticate's
        // read and its profile write. A full-aggregate save would clobber the
        // status back to Active; saveProfileFacts must preserve the suspension.
        const base = new FakeUserRepository();
        const raceRepo: UserRepository = {
            findById: (id) => base.findById(id),
            findByExternalSubject: (subject) => base.findByExternalSubject(subject),
            save: (user) => base.save(user),
            saveProfileFacts: async (user) => {
                // Admin suspends the account between the read and the write.
                const stored = await base.findById(user.id);
                if (stored) {
                    await base.save(stored.suspend());
                }
                await base.saveProfileFacts(user);
            },
            createIfAbsent: (user) => base.createIfAbsent(user),
        };
        const d: AuthenticateDeps = {
            identityProvider: new FakeIdentityProvider(
                new Map([
                    [ALICE_TOKEN, ALICE_CLAIMS],
                    [
                        'token-alice-2',
                        {
                            sub: 'sub|alice',
                            displayName: 'Alice Smith',
                            email: 'alice.smith@example.com',
                        },
                    ],
                ]),
            ),
            users: raceRepo,
            userIdGenerator: new FakeUserIdGenerator(),
        };

        await authenticate(d, ALICE_TOKEN);
        await authenticate(d, 'token-alice-2');

        // The concurrent suspension survives the profile refresh — the stored
        // status is still Suspended, and the profile facts are refreshed.
        const stored = await base.findByExternalSubject('sub|alice');
        expect(stored?.status).toBe('Suspended');
        expect(stored?.displayName).toBe('Alice Smith');
        expect(stored?.email).toBe('alice.smith@example.com');
    });

    it('returns a UserSuspendedError failure for a known Suspended user before any profile refresh', async () => {
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
        const suspendedBob = User.rehydrate({
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: asEmailAddress('bob@example.com'),
            status: 'Suspended',
            externalSubject: asExternalSubject('sub|bob'),
        });
        await d.users.save(suspendedBob);

        const result = await authenticate(d, BOB_TOKEN);
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(UserSuspendedError);

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

        const [r1, r2] = await Promise.all([
            authenticate(d, 'token-a'),
            authenticate(d, 'token-b'),
        ]);
        const u1 = userOf(r1);
        const u2 = userOf(r2);

        // Both calls resolve to the same account — no duplicate platform account.
        expect(u1.id).toBe(u2.id);
        const stored = await d.users.findByExternalSubject('sub|shared');
        expect(stored).toEqual(u1);
        // The loser's candidate id was never persisted.
        expect(await d.users.findById(asUserId('user-2'))).toBeUndefined();
    });

    it('returns a UserSuspendedError failure when createIfAbsent returns a concurrently-suspended winner', async () => {
        const suspendedWinner = User.rehydrate({
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: asEmailAddress('bob@example.com'),
            status: 'Suspended',
            externalSubject: asExternalSubject('sub|bob'),
        });
        // Simulate the race: our lookup missed the account, but createIfAbsent
        // hands back a concurrently-created-and-suspended winner.
        const racedUsers: UserRepository = {
            findById: async () => undefined,
            findByExternalSubject: async () => undefined,
            save: async () => {},
            saveProfileFacts: async () => {},
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

        const result = await authenticate(d, 'token-bob');
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(UserSuspendedError);
    });

    // -- provider-claim canonicalization propagation (ADR-0015) ------------

    it('returns an InvalidProviderClaimsError failure on a first login with a blank sub and creates no account', async () => {
        const d = deps(
            new Map([
                ['token-blank-sub', { sub: '   ', displayName: 'X', email: 'x@example.com' }],
            ]),
        );

        const result = await authenticate(d, 'token-blank-sub');
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(InvalidProviderClaimsError);

        // No account was created for the blank subject.
        expect(await d.users.findByExternalSubject('   ')).toBeUndefined();
        expect(await d.users.findById(asUserId('user-1'))).toBeUndefined();
    });

    it('returns an InvalidProviderClaimsError failure on a first login with a blank email and creates no account', async () => {
        const d = deps(
            new Map([['token-blank-email', { sub: 'sub|new', displayName: 'X', email: '' }]]),
        );

        const result = await authenticate(d, 'token-blank-email');
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(InvalidProviderClaimsError);

        expect(await d.users.findByExternalSubject('sub|new')).toBeUndefined();
    });

    it('propagates a technical fault (unknown token) as a throw, not a Result failure (E4)', async () => {
        const d = deps(new Map([[ALICE_TOKEN, ALICE_CLAIMS]]));
        // The IdentityProvider port throws on an unknown token — a technical/adapter
        // fault that propagates to the outermost handler, distinct from the domain
        // failures (suspended, invalid claims) returned in the Result.
        await expect(authenticate(d, 'token-nobody')).rejects.toThrow(/unknown token/);
    });

    it('keeps the existing email on a subsequent login whose incoming email is blank (keep-existing guard)', async () => {
        const d = deps(
            new Map([
                ['token-a', { sub: 'sub|alice', displayName: 'Alice', email: 'Alice@Example.COM' }],
                ['token-b', { sub: 'sub|alice', displayName: 'Alice Smith', email: '' }],
            ]),
        );

        const first = userOf(await authenticate(d, 'token-a'));
        expect(first.email).toBe('alice@example.com');

        const second = userOf(await authenticate(d, 'token-b'));
        // The blank incoming email preserved the stored (normalized) email.
        expect(second.email).toBe('alice@example.com');
        expect(second.displayName).toBe('Alice Smith');
        expect(second.id).toBe(first.id);
    });

    it('keeps the existing displayName on a subsequent login whose incoming displayName is blank', async () => {
        const d = deps(
            new Map([
                ['token-a', { sub: 'sub|alice', displayName: 'Alice', email: 'alice@example.com' }],
                [
                    'token-b',
                    { sub: 'sub|alice', displayName: '   ', email: 'alice.smith@example.com' },
                ],
            ]),
        );

        const first = userOf(await authenticate(d, 'token-a'));
        const second = userOf(await authenticate(d, 'token-b'));

        expect(second.displayName).toBe('Alice');
        expect(second.email).toBe('alice.smith@example.com');
        expect(second.id).toBe(first.id);
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
