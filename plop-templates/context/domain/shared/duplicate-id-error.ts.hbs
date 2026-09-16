// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Thrown by a fake repository port's `add` when an aggregate with the same
 * id is already committed (mirrors the unique-constraint violation a real
 * Postgres `INSERT` would raise).
 *
 * A technical fault, not a business outcome the immediate caller branches
 * on: it extends `Error` rather than `DomainError` (mirrors
 * `ConcurrentModificationError`), is not part of any use case's `Result`
 * channel, and propagates untouched to the outermost handler (E4).
 *
 * `aggregate` is a plain string rather than a fixed union of literal names
 * (unlike IAM's per-aggregate errors) because a generated context's
 * aggregate names are not known ahead of time — every `new:aggregate` run
 * adds another one.
 */
export class DuplicateIdError extends Error {
    readonly aggregate: string;
    readonly id: string;

    constructor(aggregate: string, id: string) {
        super(`Duplicate ${aggregate} id: ${id}`);
        this.name = 'DuplicateIdError';
        this.aggregate = aggregate;
        this.id = id;
    }
}
