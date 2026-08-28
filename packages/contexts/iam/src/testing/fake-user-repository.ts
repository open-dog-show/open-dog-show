// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../domain/domain-ids.js';
import type { User } from '../domain/user.js';
import type { UserRepository } from '../domain/user-repository.js';

export class FakeUserRepository implements UserRepository {
    private readonly store = new Map<UserId, User>();

    async findById(id: UserId): Promise<User | undefined> {
        return this.store.get(id);
    }

    async findByExternalSubject(subject: string): Promise<User | undefined> {
        for (const user of this.store.values()) {
            if (user.externalSubject === subject) {
                return user;
            }
        }
        return undefined;
    }

    async save(user: User): Promise<void> {
        this.store.set(user.id, user);
    }

    async createIfAbsent(user: User): Promise<User> {
        // Atomic in this in-memory fake: the existence check and the insert run
        // in the same synchronous step (no await between them), so two
        // interleaved calls cannot both observe no user and both insert.
        for (const existing of this.store.values()) {
            if (existing.externalSubject === user.externalSubject) {
                return existing;
            }
        }
        this.store.set(user.id, user);
        return user;
    }
}
