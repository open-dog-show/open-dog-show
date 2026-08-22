// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { TransactionScope } from '../domain/transaction-scope.js';
import type { OutboxAppender } from '../domain/outbox-port.js';
import type { OutboxWriter } from './outbox-writer.js';
import type { DomainEvent } from '../domain/domain-event.js';
import { scopeToRlsKeys } from './rls-keys.js';

/**
 * Sets the RLS session variables from `scope` on the given client.
 *
 * **Must be called inside an explicit transaction** (after `BEGIN`):
 * `set_config(setting, value, is_local = true)` is equivalent to `SET LOCAL`,
 * so the settings are scoped to the current transaction and rolled back
 * automatically on error.  Calling this outside a transaction would scope the
 * settings to the current statement only, leaving subsequent queries unprotected.
 *
 * Variables set:
 *   - `app.tenant_id`  — UUID string, or empty string when not applicable.
 *   - `app.user_id` — UUID string, or empty string when not applicable.
 *
 * RLS policies read them via `nullif(current_setting('app.tenant_id'/'app.user_id', true), '')::uuid`
 * so an empty string safely evaluates to NULL (= no rows match the policy predicate).
 *
 * The key pair is derived from `scope` via the shared {@link scopeToRlsKeys}
 * helper so the scope → `(tenantId, userId)` normalisation lives in one place.
 * The parameterised query form prevents any SQL injection through scope values.
 */
async function setRlsSessionVars(client: pg.PoolClient, scope: TransactionScope): Promise<void> {
    const { tenantId, userId } = scopeToRlsKeys(scope);
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
}

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `body`, then commits (or rolls back on error).
 *
 * This is the single internal helper that owns the
 * connect → `BEGIN` → set RLS session vars → `body` → `COMMIT`
 * (`ROLLBACK` / release on error) flow.  {@link withTransaction} and
 * {@link withOutboxTransaction} delegate to it so the transaction boilerplate is
 * not duplicated; the outbox variant layers the in-memory event accumulator and
 * the atomic outbox write on top by folding them into `body`.  Internal — not
 * part of the kernel's public surface.
 */
async function runInTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    body: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await setRlsSessionVars(client, scope);
        const result = await body(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `fn`, then commits (or rolls back on error).
 *
 * Use this for units of work that do **not** emit domain events.
 * The callback receives only a `pg.PoolClient`.
 */
export async function withTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    return runInTransaction(pool, scope, fn);
}

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `fn`, then atomically writes any accumulated domain events via `writer`
 * before committing (or rolls back on error).
 *
 * Use this for units of work that emit domain events.  `writer` is required;
 * the callback receives `(client, outbox: OutboxAppender)`.  Events are written
 * to the outbox table in the same transaction, immediately before `COMMIT`.
 * On rollback neither the aggregate change nor the outbox rows are persisted.
 */
export async function withOutboxTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    writer: OutboxWriter,
    fn: (client: pg.PoolClient, outbox: OutboxAppender) => Promise<T>,
): Promise<T> {
    const pending: DomainEvent<unknown>[] = [];
    const appender: OutboxAppender = {
        append(...events) {
            pending.push(...events);
        },
    };

    return runInTransaction(pool, scope, async (client) => {
        const result = await fn(client, appender);
        if (pending.length > 0) {
            await writer.write(client, pending, scope);
        }
        return result;
    });
}
