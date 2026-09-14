// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { asClubId } from '../../../../../src/Shared/index.js';
import { asUserId } from '../../../../../src/iam/domain/shared/domain-ids.js';
import { RoleGrant } from '../../../../../src/iam/domain/model/role-grant/role-grant.js';
import { RoleScope } from '../../../../../src/iam/domain/model/role-grant/value-objects/role-scope.js';
import {
    UserRoleGrants,
    DuplicateRoleGrantError,
} from '../../../../../src/iam/domain/model/user-role-grants/user-role-grants.js';
import { ROLE_GRANTED_TYPE } from '../../../../../src/iam/domain/model/user-role-grants/events/role-granted.js';
import { ROLE_REVOKED_TYPE } from '../../../../../src/iam/domain/model/user-role-grants/events/role-revoked.js';

const ALICE_ID = asUserId('user-alice');
const CLUB_A = asClubId('club-a');
const CLUB_B = asClubId('club-b');

// ---------------------------------------------------------------------------
// UserRoleGrants.empty / rehydrate
// ---------------------------------------------------------------------------

describe('UserRoleGrants.empty', () => {
    it('is an empty root at version 0 for a user with no persisted grants', () => {
        const root = UserRoleGrants.empty(ALICE_ID);

        expect(root.userId).toBe(ALICE_ID);
        expect(root.version).toBe(0);
        expect(root.grants).toHaveLength(0);
    });
});

describe('UserRoleGrants.rehydrate', () => {
    it('reconstructs a root from storage, recording no event', () => {
        const root = UserRoleGrants.rehydrate({
            userId: ALICE_ID,
            version: 3,
            grants: [RoleGrant.judge()],
        });

        expect(root.version).toBe(3);
        expect(root.grants).toHaveLength(1);
        expect(root.pullEvents()).toHaveLength(0);
    });

    it('grants is a defensive copy — mutating it does not affect the aggregate', () => {
        const root = UserRoleGrants.rehydrate({
            userId: ALICE_ID,
            version: 1,
            grants: [RoleGrant.judge()],
        });

        const grants = root.grants as RoleGrant[];
        grants.push(RoleGrant.platformAdministrator());

        expect(root.grants).toHaveLength(1);
    });

    it('rejects a grants array carrying a duplicate role+scope pair (corrupt-row guard)', () => {
        // Without this guard, rehydrate could load an aggregate already
        // violating the no-duplicate invariant grant() enforces on every
        // mutation, and revoke would then remove only one of the duplicates
        // while reporting a successful revocation.
        expect(() =>
            UserRoleGrants.rehydrate({
                userId: ALICE_ID,
                version: 1,
                grants: [RoleGrant.showSecretary(CLUB_A), RoleGrant.showSecretary(CLUB_A)],
            }),
        ).toThrow(DuplicateRoleGrantError);
    });

    it('allows the same role at two different Clubs (not a duplicate)', () => {
        expect(() =>
            UserRoleGrants.rehydrate({
                userId: ALICE_ID,
                version: 1,
                grants: [RoleGrant.showSecretary(CLUB_A), RoleGrant.showSecretary(CLUB_B)],
            }),
        ).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Granting
// ---------------------------------------------------------------------------

describe('UserRoleGrants.prototype.grantShowSecretary', () => {
    it('adds a ShowSecretary grant for the given Club and records RoleGranted', () => {
        const root = UserRoleGrants.empty(ALICE_ID);

        root.grantShowSecretary(CLUB_A);

        expect(root.grants).toHaveLength(1);
        expect(root.grants[0]?.role).toBe('ShowSecretary');
        expect(root.grants[0]?.scope).toStrictEqual(RoleScope.club(CLUB_A));
        const events = root.pullEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe(ROLE_GRANTED_TYPE);
        expect(events[0]?.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
        expect(events[0]?.aggregateId).toBe(ALICE_ID);
    });

    it('allows the same role for two different Clubs', () => {
        const root = UserRoleGrants.empty(ALICE_ID);

        root.grantShowSecretary(CLUB_A);
        root.grantShowSecretary(CLUB_B);

        expect(root.grants).toHaveLength(2);
    });

    it('throws DuplicateRoleGrantError with primitive context only when the same Club grant already exists', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantShowSecretary(CLUB_A);

        let caught: unknown;
        try {
            root.grantShowSecretary(CLUB_A);
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(DuplicateRoleGrantError);
        const error = caught as DuplicateRoleGrantError;
        expect(error.userId).toBe(ALICE_ID);
        expect(error.role).toBe('ShowSecretary');
        expect(error.clubId).toBe(CLUB_A);
        // No grant remains recorded from the rejected attempt.
        expect(root.grants).toHaveLength(1);
    });
});

describe('UserRoleGrants.prototype.grantJudge', () => {
    it('adds a platform-scoped Judge grant and records RoleGranted with no clubId', () => {
        const root = UserRoleGrants.empty(ALICE_ID);

        root.grantJudge();

        expect(root.grants[0]?.scope).toStrictEqual(RoleScope.platform());
        const events = root.pullEvents();
        expect(events[0]?.payload).toEqual({ role: 'Judge', clubId: undefined });
    });

    it('throws DuplicateRoleGrantError when Judge is already granted', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantJudge();

        expect(() => {
            root.grantJudge();
        }).toThrow(DuplicateRoleGrantError);
    });
});

describe('UserRoleGrants.prototype.grantPlatformAdministrator', () => {
    it('adds a platform-scoped PlatformAdministrator grant', () => {
        const root = UserRoleGrants.empty(ALICE_ID);

        root.grantPlatformAdministrator();

        expect(root.grants[0]?.role).toBe('PlatformAdministrator');
        expect(root.grants[0]?.scope).toStrictEqual(RoleScope.platform());
    });

    it('throws DuplicateRoleGrantError when already granted', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantPlatformAdministrator();

        expect(() => {
            root.grantPlatformAdministrator();
        }).toThrow(DuplicateRoleGrantError);
    });
});

it('allows granting different roles to the same user', () => {
    const root = UserRoleGrants.empty(ALICE_ID);

    root.grantJudge();
    root.grantPlatformAdministrator();

    expect(root.grants).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// Revoking
// ---------------------------------------------------------------------------

describe('UserRoleGrants.prototype.revoke', () => {
    it('removes a matching grant and records RoleRevoked', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantShowSecretary(CLUB_A);
        root.pullEvents();

        root.revoke('ShowSecretary', RoleScope.club(CLUB_A));

        expect(root.grants).toHaveLength(0);
        const events = root.pullEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe(ROLE_REVOKED_TYPE);
        expect(events[0]?.payload).toEqual({ role: 'ShowSecretary', clubId: CLUB_A });
    });

    it('is a no-op and records no event when the grant does not exist', () => {
        const root = UserRoleGrants.empty(ALICE_ID);

        root.revoke('Judge', RoleScope.platform());

        expect(root.grants).toHaveLength(0);
        expect(root.pullEvents()).toHaveLength(0);
    });

    it('removes only the matching grant, leaving others intact', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantShowSecretary(CLUB_A);
        root.grantJudge();
        root.pullEvents();

        root.revoke('ShowSecretary', RoleScope.club(CLUB_A));

        expect(root.grants).toHaveLength(1);
        expect(root.grants[0]?.role).toBe('Judge');
    });

    it('does not remove a grant for the same role at a different Club scope', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantShowSecretary(CLUB_A);
        root.pullEvents();

        root.revoke('ShowSecretary', RoleScope.club(CLUB_B));

        expect(root.grants).toHaveLength(1);
        expect(root.pullEvents()).toHaveLength(0);
    });

    it('allows re-granting the same role+scope after it has been revoked', () => {
        const root = UserRoleGrants.empty(ALICE_ID);
        root.grantShowSecretary(CLUB_A);
        root.revoke('ShowSecretary', RoleScope.club(CLUB_A));

        expect(() => {
            root.grantShowSecretary(CLUB_A);
        }).not.toThrow();
        expect(root.grants).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Nominal brand
// ---------------------------------------------------------------------------

describe('UserRoleGrants nominality', () => {
    it('is nominal — a structural object literal is not assignable to UserRoleGrants', () => {
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notARoot: UserRoleGrants = {
            userId: ALICE_ID,
            version: 0,
            grants: [],
            grantShowSecretary: () => undefined,
            grantJudge: () => undefined,
            grantPlatformAdministrator: () => undefined,
            revoke: () => undefined,
            pullEvents: () => [],
        };
        expect(notARoot).toBeDefined();
    });
});
