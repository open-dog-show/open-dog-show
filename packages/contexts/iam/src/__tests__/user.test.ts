// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asUserId } from '../domain/domain-ids.js';
import type { User } from '../domain/user.js';
import {
    suspendUser,
    reactivateUser,
    createUser,
    refreshUserProfile,
    InvalidProviderClaimsError,
} from '../domain/user.js';
import { FakeUserRepository } from '../testing/index.js';

const ALICE_ID = asUserId('user-alice');
const BOB_ID = asUserId('user-bob');

const activeAlice: User = {
    id: ALICE_ID,
    displayName: 'Alice',
    email: 'alice@example.com',
    status: 'Active',
    externalSubject: 'sub|alice',
};

const suspendedBob: User = {
    id: BOB_ID,
    displayName: 'Bob',
    email: 'bob@example.com',
    status: 'Suspended',
    externalSubject: 'sub|bob',
};

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
});

// ---------------------------------------------------------------------------
// suspendUser
// ---------------------------------------------------------------------------

describe('suspendUser', () => {
    it('returns a Suspended copy of an Active user', () => {
        const result = suspendUser(activeAlice);

        expect(result.status).toBe('Suspended');
        expect(result.id).toBe(activeAlice.id);
        expect(result.displayName).toBe(activeAlice.displayName);
        expect(result.email).toBe(activeAlice.email);
        expect(result.externalSubject).toBe(activeAlice.externalSubject);
    });

    it('throws when called on an already-Suspended user', () => {
        expect(() => suspendUser(suspendedBob)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// reactivateUser
// ---------------------------------------------------------------------------

describe('reactivateUser', () => {
    it('returns an Active copy of a Suspended user', () => {
        const result = reactivateUser(suspendedBob);

        expect(result.status).toBe('Active');
        expect(result.id).toBe(suspendedBob.id);
        expect(result.displayName).toBe(suspendedBob.displayName);
        expect(result.email).toBe(suspendedBob.email);
        expect(result.externalSubject).toBe(suspendedBob.externalSubject);
    });

    it('throws when called on an already-Active user', () => {
        expect(() => reactivateUser(activeAlice)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

describe('createUser', () => {
    it('creates an Active user with the given id, external subject, display name, and email', () => {
        const user = createUser(ALICE_ID, 'sub|alice', 'Alice', 'alice@example.com');

        expect(user).toEqual({
            id: ALICE_ID,
            externalSubject: 'sub|alice',
            displayName: 'Alice',
            email: 'alice@example.com',
            status: 'Active',
        });
    });

    // -- canonicalization (ADR-0015) ---------------------------------------

    it('throws InvalidProviderClaimsError (field: sub) when the sub is empty', () => {
        expect(() => createUser(ALICE_ID, '', 'Alice', 'alice@example.com')).toThrow(
            InvalidProviderClaimsError,
        );
        expect(() => createUser(ALICE_ID, '', 'Alice', 'alice@example.com')).toThrow(
            expect.objectContaining({ field: 'sub' }),
        );
    });

    it('throws InvalidProviderClaimsError (field: sub) when the sub is whitespace-only', () => {
        expect(() => createUser(ALICE_ID, '   ', 'Alice', 'alice@example.com')).toThrow(
            InvalidProviderClaimsError,
        );
        expect(() => createUser(ALICE_ID, '   ', 'Alice', 'alice@example.com')).toThrow(
            expect.objectContaining({ field: 'sub' }),
        );
    });

    it('throws InvalidProviderClaimsError (field: email) when the email is empty', () => {
        expect(() => createUser(ALICE_ID, 'sub|alice', 'Alice', '')).toThrow(
            InvalidProviderClaimsError,
        );
        expect(() => createUser(ALICE_ID, 'sub|alice', 'Alice', '')).toThrow(
            expect.objectContaining({ field: 'email' }),
        );
    });

    it('throws InvalidProviderClaimsError (field: email) when the email is whitespace-only', () => {
        expect(() => createUser(ALICE_ID, 'sub|alice', 'Alice', '   ')).toThrow(
            InvalidProviderClaimsError,
        );
        expect(() => createUser(ALICE_ID, 'sub|alice', 'Alice', '   ')).toThrow(
            expect.objectContaining({ field: 'email' }),
        );
    });

    it('normalizes email by trimming and lowercasing', () => {
        const user = createUser(ALICE_ID, 'sub|alice', 'Alice', '  Alice@Example.COM  ');

        expect(user.email).toBe('alice@example.com');
    });

    it('normalizes displayName by trimming (case is preserved)', () => {
        const user = createUser(ALICE_ID, 'sub|alice', '  Alice Smith  ', 'alice@example.com');

        expect(user.displayName).toBe('Alice Smith');
    });

    it('accepts an empty displayName (a display name is cosmetic)', () => {
        const user = createUser(ALICE_ID, 'sub|alice', '', 'alice@example.com');

        expect(user.displayName).toBe('');
    });

    it('accepts a whitespace-only displayName (trimmed to empty)', () => {
        const user = createUser(ALICE_ID, 'sub|alice', '   ', 'alice@example.com');

        expect(user.displayName).toBe('');
    });

    it('stores the externalSubject verbatim (no trim, no lowercase)', () => {
        const user = createUser(ALICE_ID, '  Sub|Alice  ', 'Alice', 'alice@example.com');

        expect(user.externalSubject).toBe('  Sub|Alice  ');
    });
});

// ---------------------------------------------------------------------------
// refreshUserProfile
// ---------------------------------------------------------------------------

describe('refreshUserProfile', () => {
    it('returns a copy with refreshed displayName and email, preserving id, external subject, and status', () => {
        const refreshed = refreshUserProfile(activeAlice, 'Alice Smith', 'alice.smith@example.com');

        expect(refreshed).toEqual({
            id: ALICE_ID,
            externalSubject: 'sub|alice',
            displayName: 'Alice Smith',
            email: 'alice.smith@example.com',
            status: 'Active',
        });
    });

    it('preserves a Suspended status (refresh never changes account status)', () => {
        const refreshed = refreshUserProfile(suspendedBob, 'Robert', 'robert@example.com');

        expect(refreshed.status).toBe('Suspended');
        expect(refreshed.id).toBe(BOB_ID);
        expect(refreshed.externalSubject).toBe(suspendedBob.externalSubject);
        expect(refreshed.displayName).toBe('Robert');
        expect(refreshed.email).toBe('robert@example.com');
    });

    // -- canonicalization (ADR-0015) ---------------------------------------

    it('normalizes incoming email by trimming and lowercasing', () => {
        const refreshed = refreshUserProfile(activeAlice, 'Alice', '  Alice@Example.COM  ');

        expect(refreshed.email).toBe('alice@example.com');
    });

    it('normalizes incoming displayName by trimming (case is preserved)', () => {
        const refreshed = refreshUserProfile(activeAlice, '  Alice Smith  ', 'alice@example.com');

        expect(refreshed.displayName).toBe('Alice Smith');
    });

    it('keeps the existing email when the incoming email is blank (keep-existing guard)', () => {
        const refreshed = refreshUserProfile(activeAlice, 'Alice Smith', '   ');

        expect(refreshed.email).toBe(activeAlice.email);
        // The non-blank displayName is still applied.
        expect(refreshed.displayName).toBe('Alice Smith');
    });

    it('keeps the existing email when the incoming email is empty (keep-existing guard)', () => {
        const refreshed = refreshUserProfile(activeAlice, 'Alice Smith', '');

        expect(refreshed.email).toBe(activeAlice.email);
    });

    it('keeps the existing displayName when the incoming displayName is blank (keep-existing guard)', () => {
        const refreshed = refreshUserProfile(activeAlice, '   ', 'alice.smith@example.com');

        expect(refreshed.displayName).toBe(activeAlice.displayName);
        // The non-blank email is still applied.
        expect(refreshed.email).toBe('alice.smith@example.com');
    });

    it('keeps the existing displayName when the incoming displayName is empty (keep-existing guard)', () => {
        const refreshed = refreshUserProfile(activeAlice, '', 'alice.smith@example.com');

        expect(refreshed.displayName).toBe(activeAlice.displayName);
    });

    it('keeps both existing profile facts when both incoming claims are blank', () => {
        const refreshed = refreshUserProfile(activeAlice, '   ', '   ');

        expect(refreshed.displayName).toBe(activeAlice.displayName);
        expect(refreshed.email).toBe(activeAlice.email);
    });

    it('can still change a non-empty email to a different non-empty email', () => {
        const refreshed = refreshUserProfile(activeAlice, 'Alice', 'alice.smith@example.com');

        expect(refreshed.email).toBe('alice.smith@example.com');
    });

    it('preserves the stable id, external subject, and status on a keep-existing refresh', () => {
        const refreshed = refreshUserProfile(activeAlice, '   ', '   ');

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
        const suspended = suspendUser(activeAlice);
        await repo.save(suspended);
        const found = await repo.findById(ALICE_ID);
        expect(found?.status).toBe('Suspended');
    });
});
