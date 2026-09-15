// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tracks whether a unit-of-work's `ctx` is still open, encapsulating the
 * open/closed state behind `assertOpen`/`close` instead of a bare mutable
 * `{ value: boolean }` flag every repository-port method reads and writes
 * directly. A context's unit-of-work implementation constructs one per
 * `run` call, closes it in `run`'s `finally`, and has every wrapped
 * repository-port method call `assertOpen` before doing any work — so a
 * `ctx` that escaped its `run` callback (#188) fails fast instead of
 * touching a connection/transaction that no longer belongs to it.
 *
 * Shared by both the Postgres and in-memory unit-of-work implementations of
 * every generated context, replacing what was previously the same
 * `assertOpen` closure duplicated in each.
 */
export class UnitOfWorkGate {
    #closed = false;

    /**
     * @param buildError - Builds the error to throw when the gate is
     *   closed, given the aggregate's `typeName` and the operation that was
     *   called (`'findById' | 'add' | 'update'`). Kept as a callback rather
     *   than a fixed error type so this kernel class never imports a
     *   context-owned error class — each context has its own
     *   `UnitOfWorkClosedError`, mirroring `ConcurrentModificationError`.
     */
    constructor(private readonly buildError: (aggregate: string, operation: string) => Error) {}

    assertOpen(aggregate: string, operation: string): void {
        if (this.#closed) throw this.buildError(aggregate, operation);
    }

    close(): void {
        this.#closed = true;
    }
}
