// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Thrown by a repository's `update` when the stored row's version no longer
 * matches the version the caller loaded — another writer committed in
 * between this attempt's read and its write (optimistic concurrency).
 *
 * A technical fault, not a business outcome the immediate caller branches on
 * (mirrors `ScopeMismatchError`): it extends `Error` rather than
 * `DomainError` and is not part of any use case's `Result` channel. The
 * caller (a use case, or the composition root above it) may retry the whole
 * attempt from a fresh read; this error only proves the write did not
 * silently clobber a concurrent change.
 *
 * Also thrown by `UserRoleGrantsRepository.add` when a root for the user
 * already exists: the caller's implicit expectation (no row yet) is itself a
 * version claim — the same optimistic-concurrency fault, not a different one.
 */
export class ConcurrentModificationError extends Error {
    readonly aggregate: 'User' | 'UserRoleGrants';
    readonly id: string;
    readonly expectedVersion: number;

    constructor(aggregate: 'User' | 'UserRoleGrants', id: string, expectedVersion: number) {
        super(
            `${aggregate} '${id}' was modified concurrently (expected version ${String(expectedVersion)})`,
        );
        this.name = 'ConcurrentModificationError';
        this.aggregate = aggregate;
        this.id = id;
        this.expectedVersion = expectedVersion;
    }
}
