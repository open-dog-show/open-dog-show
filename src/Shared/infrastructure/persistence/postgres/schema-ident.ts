// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Quotes a schema identifier for safe interpolation into dynamically-built SQL,
 * by wrapping it in double quotes and doubling every embedded `"`.
 *
 * `"sample"` → `"sample"`; `"sa"mple"` → `"sa""mple"`.  The doubled quotes are
 * PostgreSQL's escape rule for quoted identifiers, so a schema name containing
 * a `"` can never break out of the identifier.
 *
 * Shared by `PgOutboxWriter` (the `INSERT … <schema>.outbox` statement),
 * `PgPollingDispatcher` (the `SELECT … / UPDATE … <schema>.outbox` statements),
 * and the test-kit migration runner. Exported from the kernel's public
 * surface so the test-kit does not reach into an internal module.
 */
export function quoteSchemaIdent(schema: string): string {
    return `"${schema.replaceAll('"', '""')}"`;
}
