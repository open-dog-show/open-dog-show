// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { TransactionScope } from '../domain/transaction-scope.js';
import type { OutboxAppender } from '../domain/outbox-port.js';
import type { OutboxWriter } from './outbox-writer.js';
import type { DomainEvent } from '../domain/domain-event.js';

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
 * RLS policies read them via `nullif(current_setting('app.user_id', true), '')::uuid`
 * so an empty string safely evaluates to NULL (= no rows match the policy predicate).
 *
 * The parameterised query form prevents any SQL injection through scope values.
 */
async function setRlsSessionVars(client: pg.PoolClient, scope: TransactionScope): Promise<void> {
    const tenantId = scope.kind === 'tenant' ? scope.tenantId : '';
    const userId = scope.kind !== 'platform' ? scope.userId : '';
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
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
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await setRlsSessionVars(client, scope);
        const result = await fn(client);
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
    const client = await pool.connect();
    const pending: DomainEvent<unknown>[] = [];
    const appender: OutboxAppender = {
        append(...events) {
            pending.push(...events);
        },
    };

    try {
        await client.query('BEGIN');
        await setRlsSessionVars(client, scope);
        const result = await fn(client, appender);
        if (pending.length > 0) {
            await writer.write(client, pending, scope);
        }
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
