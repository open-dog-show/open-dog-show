// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { PlatformTransactionScope } from '../../../../src/Shared/index.js';
import {
    asUserId,
    asEmailAddress,
    asExternalSubject,
} from '../../../../src/iam/domain/shared/domain-ids.js';
import { User } from '../../../../src/iam/domain/model/user/user.js';
import { DuplicateExternalSubjectError } from '../../../../src/iam/domain/model/user/user-repository.js';
import { UserRoleGrants } from '../../../../src/iam/domain/model/user-role-grants/user-role-grants.js';
import type {
    IamUnitOfWork,
    IamUnitOfWorkContext,
} from '../../../../src/iam/application/ports/unit-of-work.js';
import {
    AuthenticateHandler,
    type AuthenticateResponse,
    type AuthenticateError,
    UserSuspendedError,
    InvalidProviderClaimsError,
} from '../../../../src/iam/application/authenticate/authenticate.js';
import { FakeIamUnitOfWork } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-iam-unit-of-work.js';
import { FakeIdentityProvider } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-identity-provider.js';
import { FakeUserIdGenerator } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-user-id-generator.js';
import type { Result } from '../../../../src/Shared/index.js';
import { findOrFail } from '../../../test-kit/index.js';

const ALICE_TOKEN = 'token-alice';
const ALICE_CLAIMS = { sub: 'sub|alice', displayName: 'Alice', email: 'alice@example.com' };

function handler(
    tokens = new Map([[ALICE_TOKEN, ALICE_CLAIMS]]),
    unitOfWork: IamUnitOfWork = new FakeIamUnitOfWork(),
): AuthenticateHandler {
    return new AuthenticateHandler(
        unitOfWork,
        new FakeIdentityProvider(tokens),
        new FakeUserIdGenerator(),
    );
}

type AuthenticateResult = Result<AuthenticateResponse, AuthenticateError>;

// Narrowing helpers so each test reads the Result without repeating the ok/error branch (E1).
function valueOf(result: AuthenticateResult): AuthenticateResponse {
    if (!result.ok) throw new Error(`expected an ok result but got ${result.error.name}`);
    return result.value;
}
function errorOf(result: AuthenticateResult): AuthenticateError {
    if (result.ok) throw new Error('expected an error result but got ok');
    return result.error;
}

describe('AuthenticateHandler', () => {
    it('first login for an unknown sub registers a new Active user via UserRepository.add', async () => {
        const uow = new FakeIamUnitOfWork();
        const h = handler(undefined, uow);

        const response = valueOf(await h.execute({ token: ALICE_TOKEN }));

        expect(response.displayName).toBe('Alice');
        expect(response.email).toBe('alice@example.com');
        const stored = await uow.run(PlatformTransactionScope.of(), (ctx) =>
            ctx.users.findByExternalSubject('sub|alice'),
        );
        expect(stored?.id).toBe(response.userId);
        expect(stored?.status).toBe('Active');
        expect(stored?.version).toBe(1);
    });

    it('subsequent login for a known sub refreshes displayName and email from the latest claims', async () => {
        // Second login: same `sub`, refreshed profile facts, delivered under a
        // different token (the provider returns fresh claims on each login).
        const REFRESHED_CLAIMS = {
            sub: 'sub|alice',
            displayName: 'Alice Smith',
            email: 'alice.smith@example.com',
        };
        const uow = new FakeIamUnitOfWork();
        const h = handler(
            new Map([
                [ALICE_TOKEN, ALICE_CLAIMS],
                ['token-alice-2', REFRESHED_CLAIMS],
            ]),
            uow,
        );

        const first = valueOf(await h.execute({ token: ALICE_TOKEN }));
        const second = valueOf(await h.execute({ token: 'token-alice-2' }));

        // Same platform account — id is stable.
        expect(second.userId).toBe(first.userId);
        expect(second.displayName).toBe('Alice Smith');
        expect(second.email).toBe('alice.smith@example.com');
        const stored = await uow.run(PlatformTransactionScope.of(), (ctx) =>
            ctx.users.findByExternalSubject('sub|alice'),
        );
        expect(stored?.displayName).toBe('Alice Smith');
        expect(stored?.version).toBe(2);
    });

    it('returns a UserSuspendedError failure for a known Suspended user before any profile refresh', async () => {
        const BOB_TOKEN = 'token-bob';
        const uow = new FakeIamUnitOfWork();
        const h = handler(
            new Map([
                [
                    BOB_TOKEN,
                    { sub: 'sub|bob', displayName: 'Bob Smith', email: 'bob.smith@example.com' },
                ],
            ]),
            uow,
        );
        // Pre-seed a Suspended account for the same `sub`.
        const suspendedBob = User.rehydrate({
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: asEmailAddress('bob@example.com'),
            status: 'Suspended',
            externalSubject: asExternalSubject('sub|bob'),
            version: 1,
        });
        await uow.run(PlatformTransactionScope.of(), (ctx) => ctx.users.add(suspendedBob));

        const result = await h.execute({ token: BOB_TOKEN });
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(UserSuspendedError);

        // No other processing: the suspended account is left untouched (the
        // provider's refreshed claims were never written).
        const stored = await uow.run(PlatformTransactionScope.of(), (ctx) =>
            ctx.users.findByExternalSubject('sub|bob'),
        );
        expect(stored?.displayName).toBe('Bob');
        expect(stored?.version).toBe(1);
    });

    it('two concurrent first logins for the same sub yield a single account', async () => {
        const uow = new FakeIamUnitOfWork();
        const h = handler(
            new Map([
                ['token-a', { sub: 'sub|shared', displayName: 'A', email: 'a@x.com' }],
                ['token-b', { sub: 'sub|shared', displayName: 'B', email: 'b@x.com' }],
            ]),
            uow,
        );

        const [r1, r2] = await Promise.all([
            h.execute({ token: 'token-a' }),
            h.execute({ token: 'token-b' }),
        ]);
        const u1 = valueOf(r1);
        const u2 = valueOf(r2);

        // Both calls resolve to the same account — no duplicate platform account.
        expect(u1.userId).toBe(u2.userId);
        const stored = await uow.run(PlatformTransactionScope.of(), (ctx) =>
            ctx.users.findByExternalSubject('sub|shared'),
        );
        expect(stored?.id).toBe(u1.userId);
    });

    it('returns a UserSuspendedError failure when the DuplicateExternalSubjectError race resolves to a suspended winner', async () => {
        const suspendedWinner = User.rehydrate({
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: asEmailAddress('bob@example.com'),
            status: 'Suspended',
            externalSubject: asExternalSubject('sub|bob'),
            version: 1,
        });
        // A custom IamUnitOfWork simulating the race: our lookup missed the
        // account, `add` reports a concurrent winner, and re-reading finds it
        // already suspended.
        const racedUnitOfWork: IamUnitOfWork = {
            run: (_scope, body) => {
                const ctx: IamUnitOfWorkContext = {
                    users: {
                        findById: () => Promise.resolve(undefined),
                        findByExternalSubject: () => Promise.resolve(suspendedWinner),
                        add: () => {
                            throw new DuplicateExternalSubjectError('sub|bob');
                        },
                        update: () => Promise.resolve(),
                    },
                    userRoleGrants: {
                        findByUser: (userId) => Promise.resolve(UserRoleGrants.empty(userId)),
                        add: () => Promise.resolve(),
                        update: () => Promise.resolve(),
                    },
                };
                return body(ctx);
            },
        };
        const h = new AuthenticateHandler(
            racedUnitOfWork,
            new FakeIdentityProvider(
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
            new FakeUserIdGenerator(),
        );

        const result = await h.execute({ token: 'token-bob' });
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(UserSuspendedError);
    });

    it('returns an ok Result reflecting the winner when the DuplicateExternalSubjectError race resolves to an Active winner', async () => {
        // Deterministic pin of the doc'd claim ("the loser still gets a
        // properly logged-in response") for the Active-winner branch — the
        // `Promise.all` race test above exercises this path opportunistically
        // via real interleaving, but never asserts it was taken.
        const activeWinner = User.rehydrate({
            id: asUserId('user-bob'),
            displayName: 'Bob',
            email: asEmailAddress('bob@example.com'),
            status: 'Active',
            externalSubject: asExternalSubject('sub|bob'),
            version: 1,
        });
        let updatedWith: User | undefined;
        const racedUnitOfWork: IamUnitOfWork = {
            run: (_scope, body) => {
                const ctx: IamUnitOfWorkContext = {
                    users: {
                        findById: () => Promise.resolve(undefined),
                        findByExternalSubject: () => Promise.resolve(activeWinner),
                        add: () => {
                            throw new DuplicateExternalSubjectError('sub|bob');
                        },
                        update: (user) => {
                            updatedWith = user;
                            return Promise.resolve();
                        },
                    },
                    userRoleGrants: {
                        findByUser: (userId) => Promise.resolve(UserRoleGrants.empty(userId)),
                        add: () => Promise.resolve(),
                        update: () => Promise.resolve(),
                    },
                };
                return body(ctx);
            },
        };
        const h = new AuthenticateHandler(
            racedUnitOfWork,
            new FakeIdentityProvider(
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
            new FakeUserIdGenerator(),
        );

        const result = await h.execute({ token: 'token-bob' });

        const response = valueOf(result);
        expect(response.userId).toBe(activeWinner.id);
        // logIn's profile refresh actually ran on the re-read winner.
        expect(response.displayName).toBe('Bob Smith');
        expect(response.email).toBe('bob.smith@example.com');
        // The refreshed winner — not the loser's discarded candidate — was persisted.
        expect(updatedWith?.id).toBe(activeWinner.id);
        expect(updatedWith?.displayName).toBe('Bob Smith');
    });

    // -- provider-claim canonicalization propagation (ADR-0015) ------------

    it('returns an InvalidProviderClaimsError failure on a first login with a blank sub and creates no account', async () => {
        const uow = new FakeIamUnitOfWork();
        const h = handler(
            new Map([
                ['token-blank-sub', { sub: '   ', displayName: 'X', email: 'x@example.com' }],
            ]),
            uow,
        );

        const result = await h.execute({ token: 'token-blank-sub' });
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(InvalidProviderClaimsError);

        // No account was created for the blank subject.
        expect(
            await uow.run(PlatformTransactionScope.of(), (ctx) =>
                ctx.users.findByExternalSubject('   '),
            ),
        ).toBeUndefined();
    });

    it('returns an InvalidProviderClaimsError failure on a first login with a blank email and creates no account', async () => {
        const uow = new FakeIamUnitOfWork();
        const h = handler(
            new Map([['token-blank-email', { sub: 'sub|new', displayName: 'X', email: '' }]]),
            uow,
        );

        const result = await h.execute({ token: 'token-blank-email' });
        expect(result.ok).toBe(false);
        expect(errorOf(result)).toBeInstanceOf(InvalidProviderClaimsError);

        expect(
            await uow.run(PlatformTransactionScope.of(), (ctx) =>
                ctx.users.findByExternalSubject('sub|new'),
            ),
        ).toBeUndefined();
    });

    it('propagates a technical fault (unknown token) as a throw, not a Result failure (E4)', async () => {
        const h = handler(new Map([[ALICE_TOKEN, ALICE_CLAIMS]]));
        // The IdentityProvider port throws on an unknown token — a technical/adapter
        // fault that propagates to the outermost handler, distinct from the domain
        // failures (suspended, invalid claims) returned in the Result.
        await expect(h.execute({ token: 'token-nobody' })).rejects.toThrow(/unknown token/);
    });

    it('propagates ConcurrentModificationError as a throw when a concurrent write raced the login (E4)', async () => {
        // Simulate an admin suspending the account (bumping its version) between
        // this handler's read and its own `update` — the write must fail loudly
        // rather than silently overwrite the concurrent change.
        const uow = new FakeIamUnitOfWork();
        const h = handler(undefined, uow);
        await h.execute({ token: ALICE_TOKEN });

        await uow.run(PlatformTransactionScope.of(), async (ctx) => {
            const user = findOrFail(await ctx.users.findByExternalSubject('sub|alice'), 'Alice');
            await ctx.users.update(user.suspend());
        });

        // A raced IamUnitOfWork whose `findByExternalSubject` returns a
        // deliberately stale (pre-suspension) copy, so the handler's own
        // `update` call collides with the version already bumped above.
        const staleUnitOfWork: IamUnitOfWork = {
            run: (scope, body) =>
                uow.run(scope, (ctx) => {
                    const stale = User.register(asUserId('user-1'), 'sub|alice', ALICE_CLAIMS);
                    return body({
                        ...ctx,
                        users: {
                            ...ctx.users,
                            findByExternalSubject: () => Promise.resolve(stale),
                        },
                    });
                }),
        };
        const staleHandler = handler(undefined, staleUnitOfWork);

        await expect(staleHandler.execute({ token: ALICE_TOKEN })).rejects.toThrow(
            /modified concurrently/,
        );
    });

    it('keeps the existing email on a subsequent login whose incoming email is blank (keep-existing guard)', async () => {
        const h = handler(
            new Map([
                ['token-a', { sub: 'sub|alice', displayName: 'Alice', email: 'Alice@Example.COM' }],
                ['token-b', { sub: 'sub|alice', displayName: 'Alice Smith', email: '' }],
            ]),
        );

        const first = valueOf(await h.execute({ token: 'token-a' }));
        expect(first.email).toBe('alice@example.com');

        const second = valueOf(await h.execute({ token: 'token-b' }));
        // The blank incoming email preserved the stored (normalized) email.
        expect(second.email).toBe('alice@example.com');
        expect(second.displayName).toBe('Alice Smith');
        expect(second.userId).toBe(first.userId);
    });

    it('keeps the existing displayName on a subsequent login whose incoming displayName is blank', async () => {
        const h = handler(
            new Map([
                ['token-a', { sub: 'sub|alice', displayName: 'Alice', email: 'alice@example.com' }],
                [
                    'token-b',
                    { sub: 'sub|alice', displayName: '   ', email: 'alice.smith@example.com' },
                ],
            ]),
        );

        const first = valueOf(await h.execute({ token: 'token-a' }));
        const second = valueOf(await h.execute({ token: 'token-b' }));

        expect(second.displayName).toBe('Alice');
        expect(second.email).toBe('alice.smith@example.com');
        expect(second.userId).toBe(first.userId);
    });
});
