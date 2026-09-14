// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, PlatformTransactionScope } from '../../../../../src/Shared/index.js';
import { asUserId } from '../../../../../src/iam/domain/shared/domain-ids.js';
import { User } from '../../../../../src/iam/domain/model/user/user.js';
import { DuplicateExternalSubjectError } from '../../../../../src/iam/domain/model/user/user-repository.js';
import { UserRoleGrants } from '../../../../../src/iam/domain/model/user-role-grants/user-role-grants.js';
import { ConcurrentModificationError } from '../../../../../src/iam/domain/shared/concurrent-modification-error.js';
import { FakeIamUnitOfWork } from '../../../../../src/iam/infrastructure/persistence/inmemory/fake-iam-unit-of-work.js';
import { findOrFail } from '../../../../test-kit/index.js';

const SCOPE = PlatformTransactionScope.of();
const ALICE_ID = asUserId('user-alice');
const CLUB_A = asClubId('club-a');

function alice(): User {
    return User.register(ALICE_ID, 'sub|alice', {
        displayName: 'Alice',
        email: 'alice@example.com',
    });
}

// ---------------------------------------------------------------------------
// users: findById / findByExternalSubject / add / update
// ---------------------------------------------------------------------------

describe('FakeIamUnitOfWork users', () => {
    it('round-trips a user by id and external subject after add', async () => {
        const uow = new FakeIamUnitOfWork();

        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(alice());
        });

        const byId = await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID));
        const bySubject = await uow.run(SCOPE, (ctx) =>
            ctx.users.findByExternalSubject('sub|alice'),
        );
        expect(byId?.id).toBe(ALICE_ID);
        expect(bySubject?.id).toBe(ALICE_ID);
    });

    it('returns undefined for an unknown id or external subject', async () => {
        const uow = new FakeIamUnitOfWork();

        expect(await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID))).toBeUndefined();
        expect(
            await uow.run(SCOPE, (ctx) => ctx.users.findByExternalSubject('sub|nobody')),
        ).toBeUndefined();
    });

    it('add throws DuplicateExternalSubjectError for a second user with the same external subject', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(alice());
        });

        await expect(
            uow.run(SCOPE, async (ctx) => {
                await ctx.users.add(
                    User.register(asUserId('user-alice-2'), 'sub|alice', {
                        displayName: 'Impostor',
                        email: 'impostor@example.com',
                    }),
                );
            }),
        ).rejects.toBeInstanceOf(DuplicateExternalSubjectError);
    });

    it('update bumps the stored version on success', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(alice());
        });

        await uow.run(SCOPE, async (ctx) => {
            const user = findOrFail(await ctx.users.findById(ALICE_ID), 'Alice');
            await ctx.users.update(user.suspend());
        });

        const stored = await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID));
        expect(stored?.status).toBe('Suspended');
        expect(stored?.version).toBe(2);
    });

    it('rolls back an add when the body later throws — the row is never committed', async () => {
        const uow = new FakeIamUnitOfWork();

        await expect(
            uow.run(SCOPE, async (ctx) => {
                await ctx.users.add(alice());
                throw new Error('boom');
            }),
        ).rejects.toThrow('boom');

        expect(await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID))).toBeUndefined();
    });

    it('rolls back only the keys this attempt touched — an unrelated, already-committed key survives', async () => {
        // Pins the class doc's claim that rollback is targeted, not a whole-
        // collection snapshot: a naive "restore everything to how it looked
        // when this attempt started" would also erase Bob's row below, since
        // Bob is added *after* Alice's attempt starts but *before* it throws.
        const uow = new FakeIamUnitOfWork();
        const BOB_ID = asUserId('user-bob');
        let releaseAlice!: () => void;
        const blockedUntilBobCommits = new Promise<void>((resolve) => {
            releaseAlice = resolve;
        });

        const aliceAttempt = uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(alice());
            await blockedUntilBobCommits;
            throw new Error('boom');
        });

        // Bob's own, independent attempt commits in full while Alice's is still open.
        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(
                User.register(BOB_ID, 'sub|bob', { displayName: 'Bob', email: 'bob@example.com' }),
            );
        });

        releaseAlice();
        await expect(aliceAttempt).rejects.toThrow('boom');

        expect(await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID))).toBeUndefined();
        expect(await uow.run(SCOPE, (ctx) => ctx.users.findById(BOB_ID))).toBeDefined();
    });

    it('does not erase a later attempt’s committed write to the SAME row when this attempt later throws', async () => {
        // The exact scenario a naive "restore whatever I remembered" rollback
        // gets wrong: attempt A writes version 2 and pauses; attempt B reads
        // that (not-yet-resolved) version 2, writes version 3, and commits in
        // full; A then throws. A's rollback must not stomp B's version 3 with
        // A's remembered pre-write value (version 1) — B's commit is real and
        // must survive.
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(alice());
        });
        let releaseA!: () => void;
        const blockedUntilBCommits = new Promise<void>((resolve) => {
            releaseA = resolve;
        });
        // Deterministic hand-off: without this, A's and B's first `findById`
        // calls race (each evaluates the map synchronously at call time), so
        // B could read version 1 before A's update ever lands. Waiting for
        // A's explicit signal — rather than relying on await-timing luck —
        // guarantees B's read happens after A's write.
        let announceAWrote!: () => void;
        const aliceUpdatedToVersion2 = new Promise<void>((resolve) => {
            announceAWrote = resolve;
        });

        const attemptA = uow.run(SCOPE, async (ctx) => {
            const user = findOrFail(await ctx.users.findById(ALICE_ID), 'Alice');
            await ctx.users.update(user.suspend()); // writes version 2
            announceAWrote();
            await blockedUntilBCommits;
            throw new Error('boom');
        });

        // Attempt B observes A's not-yet-committed version 2 and builds on it.
        await aliceUpdatedToVersion2;
        await uow.run(SCOPE, async (ctx) => {
            const user = findOrFail(await ctx.users.findById(ALICE_ID), 'Alice');
            expect(user.version).toBe(2);
            await ctx.users.update(user.reactivate()); // writes version 3
        });

        releaseA();
        await expect(attemptA).rejects.toThrow('boom');

        const stored = await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID));
        expect(stored?.version).toBe(3);
        expect(stored?.status).toBe('Active');
    });

    // -- Acceptance criterion: a concurrent suspension between read and write
    // makes `update` fail, never silently overwriting status. ---------------

    it('update throws ConcurrentModificationError when the user was modified since it was read', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(alice());
        });

        // Reader A loads the user (version 1).
        const readByA = findOrFail(
            await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID)),
            'Alice',
        );

        // A concurrent admin suspends the account in its own, already-committed
        // unit of work — bumping the stored version to 2.
        await uow.run(SCOPE, async (ctx) => {
            const user = findOrFail(await ctx.users.findById(ALICE_ID), 'Alice');
            await ctx.users.update(user.suspend());
        });

        // Reader A's stale write must fail rather than clobber the suspension.
        await expect(
            uow.run(SCOPE, async (ctx) => {
                await ctx.users.update(readByA.logIn({ displayName: 'Alice', email: 'a@x.com' }));
            }),
        ).rejects.toBeInstanceOf(ConcurrentModificationError);

        const stored = await uow.run(SCOPE, (ctx) => ctx.users.findById(ALICE_ID));
        expect(stored?.status).toBe('Suspended');
    });
});

// ---------------------------------------------------------------------------
// userRoleGrants: findByUser / add / update
// ---------------------------------------------------------------------------

describe('FakeIamUnitOfWork userRoleGrants', () => {
    it('findByUser returns an empty root (never undefined) for a user with no grants', async () => {
        const uow = new FakeIamUnitOfWork();

        const root = await uow.run(SCOPE, (ctx) => ctx.userRoleGrants.findByUser(ALICE_ID));

        expect(root.userId).toBe(ALICE_ID);
        expect(root.version).toBe(0);
        expect(root.grants).toHaveLength(0);
    });

    it('add persists a new root at version 1 and records its events', async () => {
        const uow = new FakeIamUnitOfWork();

        await uow.run(SCOPE, async (ctx) => {
            const root = await ctx.userRoleGrants.findByUser(ALICE_ID);
            root.grantShowSecretary(CLUB_A);
            await ctx.userRoleGrants.add(root);
        });

        const stored = await uow.run(SCOPE, (ctx) => ctx.userRoleGrants.findByUser(ALICE_ID));
        expect(stored.version).toBe(1);
        expect(stored.grants).toHaveLength(1);
        expect(uow.recordedEvents).toHaveLength(1);
        expect(uow.recordedEvents[0]?.type).toBe('iam.RoleGranted');
    });

    it('update bumps the stored version and records the new events', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            const root = await ctx.userRoleGrants.findByUser(ALICE_ID);
            root.grantShowSecretary(CLUB_A);
            await ctx.userRoleGrants.add(root);
        });

        await uow.run(SCOPE, async (ctx) => {
            const root = await ctx.userRoleGrants.findByUser(ALICE_ID);
            root.grantJudge();
            await ctx.userRoleGrants.update(root);
        });

        const stored = await uow.run(SCOPE, (ctx) => ctx.userRoleGrants.findByUser(ALICE_ID));
        expect(stored.version).toBe(2);
        expect(stored.grants).toHaveLength(2);
        expect(uow.recordedEvents).toHaveLength(2);
    });

    // -- Acceptance criterion: a lost-revoke scenario (two stale updates)
    // fails on the second write. ---------------------------------------

    it('the second of two stale updates fails with ConcurrentModificationError (lost-revoke scenario)', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            const root = await ctx.userRoleGrants.findByUser(ALICE_ID);
            root.grantShowSecretary(CLUB_A);
            root.grantJudge();
            await ctx.userRoleGrants.add(root);
        });

        // Two admins independently load the same version-1 root...
        const readByA = await uow.run(SCOPE, (ctx) => ctx.userRoleGrants.findByUser(ALICE_ID));
        const readByB = await uow.run(SCOPE, (ctx) => ctx.userRoleGrants.findByUser(ALICE_ID));

        // ...admin A revokes ShowSecretary and commits first.
        await uow.run(SCOPE, async (ctx) => {
            const showSecretaryGrant = findOrFail(readByA.grants[0], 'readByA.grants[0]');
            readByA.revoke('ShowSecretary', showSecretaryGrant.scope);
            await ctx.userRoleGrants.update(readByA);
        });

        // Admin B's stale revoke of Judge must fail rather than silently
        // resurrecting ShowSecretary by overwriting A's committed change.
        await expect(
            uow.run(SCOPE, async (ctx) => {
                const judgeGrant = findOrFail(readByB.grants[1], 'readByB.grants[1]');
                readByB.revoke('Judge', judgeGrant.scope);
                await ctx.userRoleGrants.update(readByB);
            }),
        ).rejects.toBeInstanceOf(ConcurrentModificationError);

        const stored = await uow.run(SCOPE, (ctx) => ctx.userRoleGrants.findByUser(ALICE_ID));
        // A's revoke of ShowSecretary survived; B's lost update did not silently apply.
        expect(stored.grants.map((g) => g.role)).toEqual(['Judge']);
    });

    it('add throws ConcurrentModificationError when a root for the user already exists', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            const root = await ctx.userRoleGrants.findByUser(ALICE_ID);
            root.grantJudge();
            await ctx.userRoleGrants.add(root);
        });

        await expect(
            uow.run(SCOPE, async (ctx) => {
                const root = UserRoleGrants.empty(ALICE_ID);
                root.grantPlatformAdministrator();
                await ctx.userRoleGrants.add(root);
            }),
        ).rejects.toBeInstanceOf(ConcurrentModificationError);
    });
});
