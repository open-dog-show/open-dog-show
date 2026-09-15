// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Thrown by a repository port method called after the unit of work's `run`
 * has already resolved — the transaction (or, for the in-memory fake, the
 * attempt) that port was scoped to is closed, so a caller that let its `ctx`
 * escape `run`'s callback can no longer use it (#188: "context is closed
 * after `run` and throws on later use"). Carries which aggregate's port and
 * which operation were called, so a boundary handler can log the offending
 * call site (E5) rather than just "some port, somewhere".
 *
 * A technical fault, not a business outcome the immediate caller branches
 * on: it extends `Error` rather than `DomainError` (mirrors
 * `ConcurrentModificationError`), is not part of any use case's `Result`
 * channel, and signals a programming error at the call site — a `ctx` should
 * never be used outside the `body` it was passed to.
 */
export class UnitOfWorkClosedError extends Error {
    readonly aggregate: string;
    readonly operation: string;

    constructor(aggregate: string, operation: string) {
        super(
            `Unit of work is closed — ${aggregate}.${operation} was called after run() already resolved`,
        );
        this.name = 'UnitOfWorkClosedError';
        this.aggregate = aggregate;
        this.operation = operation;
    }
}
