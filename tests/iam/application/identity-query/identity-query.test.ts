// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId, PlatformTransactionScope } from '../../../../src/Shared/index.js';
import {
    asUserId,
    asEmailAddress,
    asExternalSubject,
} from '../../../../src/iam/domain/shared/domain-ids.js';
import { User } from '../../../../src/iam/domain/model/user/user.js';
import { UserRoleGrants } from '../../../../src/iam/domain/model/user-role-grants/user-role-grants.js';
import { IdentityQuery } from '../../../../src/iam/application/identity-query/identity-query.js';
import { FakeIamUnitOfWork } from '../../../../src/iam/infrastructure/persistence/inmemory/fake-iam-unit-of-work.js';

const ALICE_ID = asUserId('user-alice');
const CLUB_A = asClubId('club-a');
const SCOPE = PlatformTransactionScope.of();

describe('IdentityQuery.findIdentity', () => {
    it('returns undefined for an unknown userId', async () => {
        const query = new IdentityQuery(new FakeIamUnitOfWork());

        expect(await query.findIdentity('nobody')).toBeUndefined();
    });

    it('returns a primitive snapshot with active=true and no role grants for an Active user with none', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, (ctx) =>
            ctx.users.add(
                User.register(ALICE_ID, 'sub|alice', {
                    displayName: 'Alice',
                    email: 'alice@example.com',
                }),
            ),
        );
        const query = new IdentityQuery(uow);

        const snapshot = await query.findIdentity(ALICE_ID);

        expect(snapshot).toEqual({ userId: ALICE_ID, active: true, roleGrants: [] });
    });

    it('reflects active=false for a Suspended user', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, (ctx) =>
            ctx.users.add(
                User.rehydrate({
                    id: ALICE_ID,
                    displayName: 'Alice',
                    email: asEmailAddress('alice@example.com'),
                    status: 'Suspended',
                    externalSubject: asExternalSubject('sub|alice'),
                    version: 1,
                }),
            ),
        );
        const query = new IdentityQuery(uow);

        const snapshot = await query.findIdentity(ALICE_ID);

        expect(snapshot?.active).toBe(false);
    });

    it('includes clubId only for a Club-scoped role grant, omitting it for a platform-scoped one', async () => {
        const uow = new FakeIamUnitOfWork();
        await uow.run(SCOPE, async (ctx) => {
            await ctx.users.add(
                User.register(ALICE_ID, 'sub|alice', {
                    displayName: 'Alice',
                    email: 'alice@example.com',
                }),
            );
            const root = UserRoleGrants.empty(ALICE_ID);
            root.grantShowSecretary(CLUB_A);
            root.grantJudge();
            await ctx.userRoleGrants.add(root);
        });
        const query = new IdentityQuery(uow);

        const snapshot = await query.findIdentity(ALICE_ID);

        expect(snapshot?.roleGrants).toEqual([
            { role: 'ShowSecretary', clubId: CLUB_A },
            { role: 'Judge' },
        ]);
        // The platform-scoped entry must not carry an explicit clubId key at all.
        expect(Object.hasOwn(snapshot!.roleGrants[1]!, 'clubId')).toBe(false);
    });
});
