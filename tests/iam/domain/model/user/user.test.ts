// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import {
    asUserId,
    asEmailAddress,
    asExternalSubject,
} from '../../../../../src/iam/domain/shared/domain-ids.js';
import {
    User,
    InvalidProviderClaimsError,
    InvalidUserStatusTransitionError,
} from '../../../../../src/iam/domain/model/user/user.js';
import { FakeUserRepository } from '../../../../../src/iam/infrastructure/persistence/inmemory/index.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');

const activeAlice = User.create(ALICE_ID, 'sub|alice', {
    displayName: 'Alice',
    email: 'alice@example.com',
});

const suspendedBob = User.rehydrate({
    id: BOB_ID,
    displayName: 'Bob',
    email: asEmailAddress('bob@example.com'),
    status: 'Suspended',
    externalSubject: asExternalSubject('sub|bob'),
});

// ---------------------------------------------------------------------------
// User construction
// ---------------------------------------------------------------------------

describe('User', () => {
    it('constructs with the expected shape', () => {
        expect(activeAlice.id).toBe(ALICE_ID);
        expect(activeAlice.displayName).toBe('Alice');
        expect(activeAlice.email).toBe('alice@example.com');
        expect(activeAlice.status).toBe('Active');
        expect(activeAlice.externalSubject).toBe('sub|alice');
    });

    it('is nominal — a structural object literal is not assignable to User', () => {
        // The private #brand field closes the structural-literal leak: a bare
        // literal is not assignable to the class (mirrors RoleGrant). Every other
        // instance member (including the four methods) is present, so the missing
        // #brand is the sole reason assignment fails — isolating what's pinned.
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAUser: User = {
            id: ALICE_ID,
            displayName: 'Alice',
            email: asEmailAddress('alice@example.com'),
            status: 'Active',
            externalSubject: asExternalSubject('sub|alice'),
            suspend: () => notAUser,
            reactivate: () => notAUser,
            assertCanAuthenticate: () => undefined,
            refreshProfile: () => notAUser,
        };
        expect(notAUser).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// User.prototype.suspend
// ---------------------------------------------------------------------------

describe('User.prototype.suspend', () => {
    it('returns a Suspended copy of an Active user', () => {
        const result = activeAlice.suspend();

        expect(result.status).toBe('Suspended');
        expect(result.id).toBe(activeAlice.id);
        expect(result.displayName).toBe(activeAlice.displayName);
        expect(result.email).toBe(activeAlice.email);
        expect(result.externalSubject).toBe(activeAlice.externalSubject);
    });

    it('throws InvalidUserStatusTransitionError when called on an already-Suspended user', () => {
        expect(() => suspendedBob.suspend()).toThrow(InvalidUserStatusTransitionError);
    });
});

// ---------------------------------------------------------------------------
// User.prototype.reactivate
// ---------------------------------------------------------------------------

describe('User.prototype.reactivate', () => {
    it('returns an Active copy of a Suspended user', () => {
        const result = suspendedBob.reactivate();

        expect(result.status).toBe('Active');
        expect(result.id).toBe(suspendedBob.id);
        expect(result.displayName).toBe(suspendedBob.displayName);
        expect(result.email).toBe(suspendedBob.email);
        expect(result.externalSubject).toBe(suspendedBob.externalSubject);
    });

    it('throws InvalidUserStatusTransitionError when called on an already-Active user', () => {
        expect(() => activeAlice.reactivate()).toThrow(InvalidUserStatusTransitionError);
    });
});

// ---------------------------------------------------------------------------
// User.create
// ---------------------------------------------------------------------------

describe('User.create', () => {
    it('creates an Active user with the given id, external subject, display name, and email', () => {
        const user = User.create(ALICE_ID, 'sub|alice', {
            displayName: 'Alice',
            email: 'alice@example.com',
        });

        expect(user.id).toBe(ALICE_ID);
        expect(user.externalSubject).toBe('sub|alice');
        expect(user.displayName).toBe('Alice');
        expect(user.email).toBe('alice@example.com');
        expect(user.status).toBe('Active');
    });

    // -- canonicalization (ADR-0015) ---------------------------------------

    it('throws InvalidProviderClaimsError (field: sub) when the sub is empty', () => {
        expect(() =>
            User.create(ALICE_ID, '', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.create(ALICE_ID, '', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(expect.objectContaining({ field: 'sub' }));
    });

    it('throws InvalidProviderClaimsError (field: sub) when the sub is whitespace-only', () => {
        expect(() =>
            User.create(ALICE_ID, '   ', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.create(ALICE_ID, '   ', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(expect.objectContaining({ field: 'sub' }));
    });

    it('throws InvalidProviderClaimsError (field: email) when the email is empty', () => {
        expect(() =>
            User.create(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.create(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '' }),
        ).toThrow(expect.objectContaining({ field: 'email' }));
    });

    it('throws InvalidProviderClaimsError (field: email) when the email is whitespace-only', () => {
        expect(() =>
            User.create(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '   ' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.create(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '   ' }),
        ).toThrow(expect.objectContaining({ field: 'email' }));
    });

    it('normalizes email by trimming and lowercasing', () => {
        const user = User.create(ALICE_ID, 'sub|alice', {
            displayName: 'Alice',
            email: '  Alice@Example.COM  ',
        });

        expect(user.email).toBe('alice@example.com');
    });

    it('normalizes displayName by trimming (case is preserved)', () => {
        const user = User.create(ALICE_ID, 'sub|alice', {
            displayName: '  Alice Smith  ',
            email: 'alice@example.com',
        });

        expect(user.displayName).toBe('Alice Smith');
    });

    it('accepts an empty displayName (a display name is cosmetic)', () => {
        const user = User.create(ALICE_ID, 'sub|alice', {
            displayName: '',
            email: 'alice@example.com',
        });

        expect(user.displayName).toBe('');
    });

    it('accepts a whitespace-only displayName (trimmed to empty)', () => {
        const user = User.create(ALICE_ID, 'sub|alice', {
            displayName: '   ',
            email: 'alice@example.com',
        });

        expect(user.displayName).toBe('');
    });

    it('stores the externalSubject verbatim (no trim, no lowercase)', () => {
        const user = User.create(ALICE_ID, '  Sub|Alice  ', {
            displayName: 'Alice',
            email: 'alice@example.com',
        });

        expect(user.externalSubject).toBe('  Sub|Alice  ');
    });
});

// ---------------------------------------------------------------------------
// User.rehydrate
// ---------------------------------------------------------------------------

describe('User.rehydrate', () => {
    it('reconstructs a user from already-canonical storage columns', () => {
        expect(suspendedBob.id).toBe(BOB_ID);
        expect(suspendedBob.displayName).toBe('Bob');
        expect(suspendedBob.email).toBe('bob@example.com');
        expect(suspendedBob.status).toBe('Suspended');
        expect(suspendedBob.externalSubject).toBe('sub|bob');
    });

    it('does not re-run claim canonicalization (unlike create), passing a non-canonical row through unchanged', () => {
        // Unlike `create`, `rehydrate` trusts the row is already canonical — it
        // must not normalize a value that (by construction bug or migration)
        // arrives un-trimmed/un-lowercased.
        const rehydrated = User.rehydrate({
            id: BOB_ID,
            displayName: '  Bob  ',
            email: asEmailAddress('  Bob@Example.COM  '),
            status: 'Active',
            externalSubject: asExternalSubject('sub|bob'),
        });

        expect(rehydrated.displayName).toBe('  Bob  ');
        expect(rehydrated.email).toBe('  Bob@Example.COM  ');
    });

    it('still rejects a blank email — the constructor guard runs on every construction path', () => {
        // Unlike canonicalization, blank-claim rejection is NOT skipped by
        // rehydrate: a corrupt or pre-ADR-0015 row must not silently produce
        // an invalid User (mirrors RoleGrant.rehydrate's role/scope guard).
        expect(() =>
            User.rehydrate({
                id: BOB_ID,
                displayName: 'Bob',
                email: asEmailAddress(''),
                status: 'Active',
                externalSubject: asExternalSubject('sub|bob'),
            }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.rehydrate({
                id: BOB_ID,
                displayName: 'Bob',
                email: asEmailAddress('bob@example.com'),
                status: 'Active',
                externalSubject: asExternalSubject(''),
            }),
        ).toThrow(InvalidProviderClaimsError);
    });
});

// ---------------------------------------------------------------------------
// User.prototype.refreshProfile
// ---------------------------------------------------------------------------

describe('User.prototype.refreshProfile', () => {
    it('returns a copy with refreshed displayName and email, preserving id, external subject, and status', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: 'Alice Smith',
            email: 'alice.smith@example.com',
        });

        expect(refreshed.id).toBe(ALICE_ID);
        expect(refreshed.externalSubject).toBe('sub|alice');
        expect(refreshed.displayName).toBe('Alice Smith');
        expect(refreshed.email).toBe('alice.smith@example.com');
        expect(refreshed.status).toBe('Active');
    });

    it('preserves a Suspended status (refresh never changes account status)', () => {
        const refreshed = suspendedBob.refreshProfile({
            displayName: 'Robert',
            email: 'robert@example.com',
        });

        expect(refreshed.status).toBe('Suspended');
        expect(refreshed.id).toBe(BOB_ID);
        expect(refreshed.externalSubject).toBe(suspendedBob.externalSubject);
        expect(refreshed.displayName).toBe('Robert');
        expect(refreshed.email).toBe('robert@example.com');
    });

    // -- canonicalization (ADR-0015) ---------------------------------------

    it('normalizes incoming email by trimming and lowercasing', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: 'Alice',
            email: '  Alice@Example.COM  ',
        });

        expect(refreshed.email).toBe('alice@example.com');
    });

    it('normalizes incoming displayName by trimming (case is preserved)', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: '  Alice Smith  ',
            email: 'alice@example.com',
        });

        expect(refreshed.displayName).toBe('Alice Smith');
    });

    it('keeps the existing email when the incoming email is blank (keep-existing guard)', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: 'Alice Smith',
            email: '   ',
        });

        expect(refreshed.email).toBe(activeAlice.email);
        // The non-blank displayName is still applied.
        expect(refreshed.displayName).toBe('Alice Smith');
    });

    it('keeps the existing email when the incoming email is empty (keep-existing guard)', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: 'Alice Smith',
            email: '',
        });

        expect(refreshed.email).toBe(activeAlice.email);
    });

    it('keeps the existing displayName when the incoming displayName is blank (keep-existing guard)', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: '   ',
            email: 'alice.smith@example.com',
        });

        expect(refreshed.displayName).toBe(activeAlice.displayName);
        // The non-blank email is still applied.
        expect(refreshed.email).toBe('alice.smith@example.com');
    });

    it('keeps the existing displayName when the incoming displayName is empty (keep-existing guard)', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: '',
            email: 'alice.smith@example.com',
        });

        expect(refreshed.displayName).toBe(activeAlice.displayName);
    });

    it('keeps both existing profile facts when both incoming claims are blank', () => {
        const refreshed = activeAlice.refreshProfile({ displayName: '   ', email: '   ' });

        expect(refreshed.displayName).toBe(activeAlice.displayName);
        expect(refreshed.email).toBe(activeAlice.email);
    });

    it('can still change a non-empty email to a different non-empty email', () => {
        const refreshed = activeAlice.refreshProfile({
            displayName: 'Alice',
            email: 'alice.smith@example.com',
        });

        expect(refreshed.email).toBe('alice.smith@example.com');
    });

    it('preserves the stable id, external subject, and status on a keep-existing refresh', () => {
        const refreshed = activeAlice.refreshProfile({ displayName: '   ', email: '   ' });

        expect(refreshed.id).toBe(activeAlice.id);
        expect(refreshed.externalSubject).toBe(activeAlice.externalSubject);
        expect(refreshed.status).toBe(activeAlice.status);
    });
});

// ---------------------------------------------------------------------------
// FakeUserRepository round-trip
// ---------------------------------------------------------------------------

describe('FakeUserRepository', () => {
    let repo: FakeUserRepository;

    beforeEach(() => {
        repo = new FakeUserRepository();
    });

    it('returns undefined for an unknown id', async () => {
        const result = await repo.findById(ALICE_ID);
        expect(result).toBeUndefined();
    });

    it('round-trips a user by id', async () => {
        await repo.save(activeAlice);
        const found = await repo.findById(ALICE_ID);
        expect(found).toEqual(activeAlice);
    });

    it('round-trips a user by external subject', async () => {
        await repo.save(activeAlice);
        const found = await repo.findByExternalSubject('sub|alice');
        expect(found).toEqual(activeAlice);
    });

    it('returns undefined for an unknown external subject', async () => {
        const result = await repo.findByExternalSubject('sub|nobody');
        expect(result).toBeUndefined();
    });

    it('overwrites on re-save (upsert)', async () => {
        await repo.save(activeAlice);
        const suspended = activeAlice.suspend();
        await repo.save(suspended);
        const found = await repo.findById(ALICE_ID);
        expect(found?.status).toBe('Suspended');
    });
});
