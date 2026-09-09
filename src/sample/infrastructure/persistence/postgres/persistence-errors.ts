// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Technical errors thrown when the sample-context Drizzle repositories fail to
 * reach PostgreSQL (E3): the raw `pg`/drizzle exception is wrapped here — at
 * the infrastructure boundary — so no outer-circle exception type crosses
 * inward into the application/domain layers. The original error's *message*
 * is preserved on `cause` (a string, per the implementation-patterns E3 idiom
 * — never the foreign error object itself) for the boundary handler to log
 * (E5, L4).
 *
 * One class per aggregate's persistence operation (E2): the boundary decides
 * how to report a failed entry save vs a failed show read. These are technical
 * errors (I/O faults), not domain-rule violations, so they extend `Error`
 * rather than `DomainError` and are handled generically at the outermost
 * boundary (E4).
 */
export class EntryPersistenceFailed extends Error {
    constructor(operation: string, error: unknown) {
        super(`Entry persistence failed while ${operation}`, {
            cause: error instanceof Error ? error.message : String(error),
        });
        this.name = 'EntryPersistenceFailed';
    }
}

export class ShowPersistenceFailed extends Error {
    constructor(operation: string, error: unknown) {
        super(`Show persistence failed while ${operation}`, {
            cause: error instanceof Error ? error.message : String(error),
        });
        this.name = 'ShowPersistenceFailed';
    }
}
