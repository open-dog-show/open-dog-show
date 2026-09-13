// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from '../../shared/domain-ids.js';
import type { User } from './user.js';

/**
 * Persistence port for the `User` aggregate (ADR-0026).
 *
 * `add` is insert-only — a duplicate `externalSubject` fails loudly with
 * {@link DuplicateExternalSubjectError} instead of silently overwriting, so
 * two concurrent first logins for the same external subject cannot mint two
 * platform accounts (`AuthenticateHandler` catches this once and re-reads).
 * `update` checks the aggregate's `version` and throws
 * `ConcurrentModificationError` (`../../shared/concurrent-modification-error.js`)
 * on a mismatch — a concurrent write (e.g. an admin suspending the account)
 * between load and save is never silently clobbered. Changes go through
 * `findById`/`findByExternalSubject` → mutator → `update`.
 */
export interface UserRepository {
    findById(id: UserId): Promise<User | undefined>;
    findByExternalSubject(subject: string): Promise<User | undefined>;
    /** @throws {DuplicateExternalSubjectError} when a User with the same `externalSubject` already exists. */
    add(user: User): Promise<void>;
    /** @throws {ConcurrentModificationError} when the stored version no longer matches `user.version`. */
    update(user: User): Promise<void>;
}

/**
 * Thrown by {@link UserRepository.add} when a User with the same
 * `externalSubject` already exists.
 *
 * A technical fault, not a business outcome the immediate caller branches on
 * (mirrors `ScopeMismatchError`): it extends `Error` rather than
 * `DomainError`. `AuthenticateHandler` is the one intended catcher — a
 * first-login race where a concurrent request already inserted the account —
 * and it catches this exactly once before re-reading the winner and
 * continuing through `User.prototype.logIn`.
 */
export class DuplicateExternalSubjectError extends Error {
    readonly externalSubject: string;

    constructor(externalSubject: string) {
        super(`A User with external subject '${externalSubject}' already exists`);
        this.name = 'DuplicateExternalSubjectError';
        this.externalSubject = externalSubject;
    }
}
