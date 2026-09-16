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

    /**
     * A plain-function-callable factory, not just `new UnitOfWorkClosedError`
     * itself: a class constructor can't be passed where a bare function is
     * expected (calling it without `new` throws), so `UnitOfWorkGate`'s
     * `buildError` callback — this context's `run()` passes `.build`
     * directly — needs one. Doesn't read `this`, so passing it bare is safe
     * despite `@typescript-eslint/unbound-method`'s static analysis limit
     * (the rule can't prove that; a `this: void` annotation would prove it
     * but trips this repo's `no-invalid-void-type` config instead — see the
     * disable comment at each call site).
     */
    static build(aggregate: string, operation: string): UnitOfWorkClosedError {
        return new UnitOfWorkClosedError(aggregate, operation);
    }
}
