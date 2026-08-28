// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from './domain-ids.js';
import type { User } from './user.js';

export interface UserRepository {
    findById(id: UserId): Promise<User | undefined>;
    findByExternalSubject(subject: string): Promise<User | undefined>;
    save(user: User): Promise<void>;
    /**
     * Atomically insert `user` unless a user with the same `externalSubject`
     * already exists; returns the persisted user — the inserted one, or the
     * pre-existing one on conflict (the concurrent winner). The atomic
     * check-and-insert prevents a check-then-act race producing two accounts
     * for one external subject under concurrent first logins.
     */
    createIfAbsent(user: User): Promise<User>;
}
