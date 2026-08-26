// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach } from 'vitest';
import { asUserId } from '../domain/domain-ids.js';
import type { User } from '../domain/user.js';
import { suspendUser, reactivateUser } from '../domain/user.js';
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
