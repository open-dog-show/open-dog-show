// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../../../domain/shared/domain-ids.js';
import { User } from '../../../domain/model/user/user.js';
import type { UserRepository } from '../../../domain/model/user/user-repository.js';

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

    async saveProfileFacts(user: User): Promise<void> {
        // Merge only the refreshable profile facts, preserving the stored
        // identity (id, external subject) and — critically — `status`, so a
        // profile refresh on a returning login can never clobber a concurrent
        // suspension (lost-update guard).
        const stored = this.store.get(user.id);
        if (stored === undefined) {
            // A profile refresh mirrors `UPDATE ... WHERE id = ?`: it cannot
            // resurrect a row deleted between lookup and refresh, so leave it
            // absent rather than rebuilding an aggregate from profile facts alone.
            return;
        }
        this.store.set(
            user.id,
            User.rehydrate({
                id: stored.id,
                displayName: user.displayName,
                email: user.email,
                status: stored.status,
                externalSubject: stored.externalSubject,
            }),
        );
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
