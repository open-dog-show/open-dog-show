// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Thrown by a generated aggregate repository's `update` when the stored
 * row's version no longer matches the version the caller loaded — another
 * writer committed in between this attempt's read and its write (optimistic
 * concurrency; mirrors IAM's `ConcurrentModificationError`).
 *
 * A technical fault, not a business outcome the immediate caller branches on:
 * it extends `Error` rather than `DomainError`, is not part of any use
 * case's `Result` channel, and propagates past the `Result`-mapping
 * try/catch in a generated `Rename<Aggregate>Handler` untouched (E4). The
 * caller (a use case, or the composition root above it) may retry the whole
 * attempt from a fresh read; this error only proves the write did not
 * silently clobber a concurrent change.
 *
 * `aggregate` is a plain string rather than a fixed union of literal names
 * (unlike IAM's `'User' | 'UserRoleGrants'`) because a generated context's
 * aggregate names are not known ahead of time — every `new:aggregate` run
 * adds another one.
 */
export class ConcurrentModificationError extends Error {
    readonly aggregate: string;
    readonly id: string;
    readonly expectedVersion: number;

    constructor(aggregate: string, id: string, expectedVersion: number) {
        super(
            `${aggregate} '${id}' was modified concurrently (expected version ${String(expectedVersion)})`,
        );
        this.name = 'ConcurrentModificationError';
        this.aggregate = aggregate;
        this.id = id;
        this.expectedVersion = expectedVersion;
    }
}
