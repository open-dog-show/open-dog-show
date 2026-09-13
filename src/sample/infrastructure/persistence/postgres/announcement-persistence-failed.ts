// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Technical error thrown when the announcement Drizzle repository fails
 * to reach PostgreSQL (E3): the raw `pg`/drizzle exception is wrapped here —
 * at the infrastructure boundary — so no outer-circle exception type crosses
 * inward into the application/domain layers. The original error's *message*
 * is preserved on `cause` (a string, per the implementation-patterns E3
 * idiom — never the foreign error object itself) for the boundary handler to
 * log (E5, L4).
 *
 * This is a technical error (an I/O fault), not a domain-rule violation, so
 * it extends `Error` rather than `DomainError` and is handled generically at
 * the outermost boundary (E4).
 */
export class AnnouncementPersistenceFailed extends Error {
    constructor(operation: string, error: unknown) {
        super(`Announcement persistence failed while ${operation}`, {
            cause: error instanceof Error ? error.message : String(error),
        });
        this.name = 'AnnouncementPersistenceFailed';
    }
}
