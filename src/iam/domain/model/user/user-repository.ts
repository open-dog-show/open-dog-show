// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../../shared/domain-ids.js';
import type { User } from './user.js';

export interface UserRepository {
    findById(id: UserId): Promise<User | undefined>;
    findByExternalSubject(subject: string): Promise<User | undefined>;
    save(user: User): Promise<void>;
    /**
     * Persists only the refreshable profile facts (`displayName` and `email`)
     * of `user`, leaving every other column — notably `status` — untouched.
     *
     * This is the safe write path for a profile refresh on a returning login:
     * {@link authenticate} reads the account, checks it is not `Suspended`, then
     * refreshes the profile. If an admin suspends the account between that read
     * and the write, a full-aggregate `save` would clobber `status` back to
     * `Active` (a lost update). `saveProfileFacts` writes only the profile
     * columns, so a concurrent suspension is preserved.
     */
    saveProfileFacts(user: User): Promise<void>;
    /**
     * Atomically insert `user` unless a user with the same `externalSubject`
     * already exists; returns the persisted user — the inserted one, or the
     * pre-existing one on conflict (the concurrent winner). The atomic
     * check-and-insert prevents a check-then-act race producing two accounts
     * for one external subject under concurrent first logins.
     */
    createIfAbsent(user: User): Promise<User>;
}
