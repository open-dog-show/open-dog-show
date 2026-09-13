// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    asUserId,
    asEmailAddress,
    asExternalSubject,
} from '../../../../../src/iam/domain/shared/domain-ids.js';
import {
    User,
    InvalidProviderClaimsError,
    InvalidUserStatusTransitionError,
    UserSuspendedError,
} from '../../../../../src/iam/domain/model/user/user.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');

const activeAlice = User.register(ALICE_ID, 'sub|alice', {
    displayName: 'Alice',
    email: 'alice@example.com',
});

const suspendedBob = User.rehydrate({
    id: BOB_ID,
    displayName: 'Bob',
    email: asEmailAddress('bob@example.com'),
    status: 'Suspended',
    externalSubject: asExternalSubject('sub|bob'),
    version: 1,
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
        expect(activeAlice.version).toBe(1);
    });

    it('is nominal — a structural object literal is not assignable to User', () => {
        // The private #brand field closes the structural-literal leak: a bare
        // literal is not assignable to the class. Every other instance member
        // (including the methods) is present, so the missing #brand is the
        // sole reason assignment fails — isolating what's pinned.
        // @ts-expect-error — Property '#brand' is missing in the object literal.
        const notAUser: User = {
            id: ALICE_ID,
            displayName: 'Alice',
            email: asEmailAddress('alice@example.com'),
            status: 'Active',
            externalSubject: asExternalSubject('sub|alice'),
            version: 1,
            suspend: () => notAUser,
            reactivate: () => notAUser,
            isActive: () => true,
            logIn: () => notAUser,
        };
        expect(notAUser).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// User.prototype.suspend
// ---------------------------------------------------------------------------

describe('User.prototype.suspend', () => {
    it('returns a Suspended copy of an Active user, preserving its version', () => {
        const result = activeAlice.suspend();

        expect(result.status).toBe('Suspended');
        expect(result.id).toBe(activeAlice.id);
        expect(result.displayName).toBe(activeAlice.displayName);
        expect(result.email).toBe(activeAlice.email);
        expect(result.externalSubject).toBe(activeAlice.externalSubject);
        expect(result.version).toBe(activeAlice.version);
    });

    it('throws InvalidUserStatusTransitionError when called on an already-Suspended user', () => {
        expect(() => suspendedBob.suspend()).toThrow(InvalidUserStatusTransitionError);
    });
});

// ---------------------------------------------------------------------------
// User.prototype.reactivate
// ---------------------------------------------------------------------------

describe('User.prototype.reactivate', () => {
    it('returns an Active copy of a Suspended user, preserving its version', () => {
        const result = suspendedBob.reactivate();

        expect(result.status).toBe('Active');
        expect(result.id).toBe(suspendedBob.id);
        expect(result.displayName).toBe(suspendedBob.displayName);
        expect(result.email).toBe(suspendedBob.email);
        expect(result.externalSubject).toBe(suspendedBob.externalSubject);
        expect(result.version).toBe(suspendedBob.version);
    });

    it('throws InvalidUserStatusTransitionError when called on an already-Active user', () => {
        expect(() => activeAlice.reactivate()).toThrow(InvalidUserStatusTransitionError);
    });
});

// ---------------------------------------------------------------------------
// User.prototype.isActive
// ---------------------------------------------------------------------------

describe('User.prototype.isActive', () => {
    it('is true for an Active user', () => {
        expect(activeAlice.isActive()).toBe(true);
    });

    it('is false for a Suspended user', () => {
        expect(suspendedBob.isActive()).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// User.register
// ---------------------------------------------------------------------------

describe('User.register', () => {
    it('registers an Active user at version 1 with the given id, external subject, display name, and email', () => {
        const user = User.register(ALICE_ID, 'sub|alice', {
            displayName: 'Alice',
            email: 'alice@example.com',
        });

        expect(user.id).toBe(ALICE_ID);
        expect(user.externalSubject).toBe('sub|alice');
        expect(user.displayName).toBe('Alice');
        expect(user.email).toBe('alice@example.com');
        expect(user.status).toBe('Active');
        expect(user.version).toBe(1);
    });

    // -- canonicalization (ADR-0015) ---------------------------------------

    it('throws InvalidProviderClaimsError (field: sub) when the sub is empty', () => {
        expect(() =>
            User.register(ALICE_ID, '', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.register(ALICE_ID, '', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(expect.objectContaining({ field: 'sub' }));
    });

    it('throws InvalidProviderClaimsError (field: sub) when the sub is whitespace-only', () => {
        expect(() =>
            User.register(ALICE_ID, '   ', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.register(ALICE_ID, '   ', { displayName: 'Alice', email: 'alice@example.com' }),
        ).toThrow(expect.objectContaining({ field: 'sub' }));
    });

    it('throws InvalidProviderClaimsError (field: email) when the email is empty', () => {
        expect(() =>
            User.register(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.register(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '' }),
        ).toThrow(expect.objectContaining({ field: 'email' }));
    });

    it('throws InvalidProviderClaimsError (field: email) when the email is whitespace-only', () => {
        expect(() =>
            User.register(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '   ' }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.register(ALICE_ID, 'sub|alice', { displayName: 'Alice', email: '   ' }),
        ).toThrow(expect.objectContaining({ field: 'email' }));
    });

    it('normalizes email by trimming and lowercasing', () => {
        const user = User.register(ALICE_ID, 'sub|alice', {
            displayName: 'Alice',
            email: '  Alice@Example.COM  ',
        });

        expect(user.email).toBe('alice@example.com');
    });

    it('normalizes displayName by trimming (case is preserved)', () => {
        const user = User.register(ALICE_ID, 'sub|alice', {
            displayName: '  Alice Smith  ',
            email: 'alice@example.com',
        });

        expect(user.displayName).toBe('Alice Smith');
    });

    it('accepts an empty displayName (a display name is cosmetic)', () => {
        const user = User.register(ALICE_ID, 'sub|alice', {
            displayName: '',
            email: 'alice@example.com',
        });

        expect(user.displayName).toBe('');
    });

    it('accepts a whitespace-only displayName (trimmed to empty)', () => {
        const user = User.register(ALICE_ID, 'sub|alice', {
            displayName: '   ',
            email: 'alice@example.com',
        });

        expect(user.displayName).toBe('');
    });

    it('stores the externalSubject verbatim (no trim, no lowercase)', () => {
        const user = User.register(ALICE_ID, '  Sub|Alice  ', {
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
    it('reconstructs a user from already-canonical storage columns, including its version', () => {
        expect(suspendedBob.id).toBe(BOB_ID);
        expect(suspendedBob.displayName).toBe('Bob');
        expect(suspendedBob.email).toBe('bob@example.com');
        expect(suspendedBob.status).toBe('Suspended');
        expect(suspendedBob.externalSubject).toBe('sub|bob');
        expect(suspendedBob.version).toBe(1);
    });

    it('does not re-run claim canonicalization (unlike register), passing a non-canonical row through unchanged', () => {
        // Unlike `register`, `rehydrate` trusts the row is already canonical — it
        // must not normalize a value that (by construction bug or migration)
        // arrives un-trimmed/un-lowercased.
        const rehydrated = User.rehydrate({
            id: BOB_ID,
            displayName: '  Bob  ',
            email: asEmailAddress('  Bob@Example.COM  '),
            status: 'Active',
            externalSubject: asExternalSubject('sub|bob'),
            version: 3,
        });

        expect(rehydrated.displayName).toBe('  Bob  ');
        expect(rehydrated.email).toBe('  Bob@Example.COM  ');
        expect(rehydrated.version).toBe(3);
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
                version: 1,
            }),
        ).toThrow(InvalidProviderClaimsError);
        expect(() =>
            User.rehydrate({
                id: BOB_ID,
                displayName: 'Bob',
                email: asEmailAddress('bob@example.com'),
                status: 'Active',
                externalSubject: asExternalSubject(''),
                version: 1,
            }),
        ).toThrow(InvalidProviderClaimsError);
    });
});

// ---------------------------------------------------------------------------
// User.prototype.logIn
// ---------------------------------------------------------------------------

describe('User.prototype.logIn', () => {
    it('returns a copy with refreshed displayName and email, preserving id, external subject, status, and version', () => {
        const loggedIn = activeAlice.logIn({
            displayName: 'Alice Smith',
            email: 'alice.smith@example.com',
        });

        expect(loggedIn.id).toBe(ALICE_ID);
        expect(loggedIn.externalSubject).toBe('sub|alice');
        expect(loggedIn.displayName).toBe('Alice Smith');
        expect(loggedIn.email).toBe('alice.smith@example.com');
        expect(loggedIn.status).toBe('Active');
        expect(loggedIn.version).toBe(activeAlice.version);
    });

    it('throws UserSuspendedError for a Suspended user, before any profile change', () => {
        expect(() =>
            suspendedBob.logIn({ displayName: 'Robert', email: 'robert@example.com' }),
        ).toThrow(UserSuspendedError);
    });

    // -- canonicalization (ADR-0015) ---------------------------------------

    it('normalizes incoming email by trimming and lowercasing', () => {
        const loggedIn = activeAlice.logIn({
            displayName: 'Alice',
            email: '  Alice@Example.COM  ',
        });

        expect(loggedIn.email).toBe('alice@example.com');
    });

    it('normalizes incoming displayName by trimming (case is preserved)', () => {
        const loggedIn = activeAlice.logIn({
            displayName: '  Alice Smith  ',
            email: 'alice@example.com',
        });

        expect(loggedIn.displayName).toBe('Alice Smith');
    });

    it('keeps the existing email when the incoming email is blank (keep-existing guard)', () => {
        const loggedIn = activeAlice.logIn({ displayName: 'Alice Smith', email: '   ' });

        expect(loggedIn.email).toBe(activeAlice.email);
        // The non-blank displayName is still applied.
        expect(loggedIn.displayName).toBe('Alice Smith');
    });

    it('keeps the existing email when the incoming email is empty (keep-existing guard)', () => {
        const loggedIn = activeAlice.logIn({ displayName: 'Alice Smith', email: '' });

        expect(loggedIn.email).toBe(activeAlice.email);
    });

    it('keeps the existing displayName when the incoming displayName is blank (keep-existing guard)', () => {
        const loggedIn = activeAlice.logIn({
            displayName: '   ',
            email: 'alice.smith@example.com',
        });

        expect(loggedIn.displayName).toBe(activeAlice.displayName);
        // The non-blank email is still applied.
        expect(loggedIn.email).toBe('alice.smith@example.com');
    });

    it('keeps the existing displayName when the incoming displayName is empty (keep-existing guard)', () => {
        const loggedIn = activeAlice.logIn({
            displayName: '',
            email: 'alice.smith@example.com',
        });

        expect(loggedIn.displayName).toBe(activeAlice.displayName);
    });

    it('keeps both existing profile facts when both incoming claims are blank', () => {
        const loggedIn = activeAlice.logIn({ displayName: '   ', email: '   ' });

        expect(loggedIn.displayName).toBe(activeAlice.displayName);
        expect(loggedIn.email).toBe(activeAlice.email);
    });

    it('can still change a non-empty email to a different non-empty email', () => {
        const loggedIn = activeAlice.logIn({
            displayName: 'Alice',
            email: 'alice.smith@example.com',
        });

        expect(loggedIn.email).toBe('alice.smith@example.com');
    });

    it('preserves the stable id, external subject, and status on a keep-existing login', () => {
        const loggedIn = activeAlice.logIn({ displayName: '   ', email: '   ' });

        expect(loggedIn.id).toBe(activeAlice.id);
        expect(loggedIn.externalSubject).toBe(activeAlice.externalSubject);
        expect(loggedIn.status).toBe(activeAlice.status);
    });
});
