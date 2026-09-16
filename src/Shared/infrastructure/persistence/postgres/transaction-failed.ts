// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Technical error thrown when a step of the transaction lifecycle itself
 * fails — checking out a client (`pool.connect()`), `BEGIN`, setting the RLS
 * session variables (`set_config`), or `COMMIT` (E3).
 *
 * Deliberately narrower than "anything that goes wrong inside a transaction":
 * a `body`/use-case error (a business failure, or a test's simulated failure)
 * is not wrapped — only the surrounding pg plumbing is. The raw `pg`
 * exception is wrapped here, at the infrastructure boundary, so no
 * outer-circle exception type crosses inward; the original error's *message*
 * is preserved on `cause` (a string, per the E3 idiom) for the boundary
 * handler to log (E5, L4).
 *
 * A technical error (I/O fault), not a domain-rule violation, so it extends
 * `Error` rather than `DomainError` and is handled generically at the
 * outermost boundary (E4).
 */
export class TransactionFailed extends Error {
    constructor(operation: string, error: unknown) {
        super(`Transaction failed while ${operation}`, {
            cause: error instanceof Error ? error.message : String(error),
        });
        this.name = 'TransactionFailed';
    }
}
