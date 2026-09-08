// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { TransactionScope } from '../domain/transaction-scope.js';
import type { OutboxAppender } from '../application/ports/outbox-appender.js';
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
 *   - `app.club_id`  — UUID string, or empty string when not applicable.
 *   - `app.user_id` — UUID string, or empty string when not applicable.
 *
 * RLS policies read them via `nullif(current_setting('app.club_id'/'app.user_id', true), '')::uuid`
 * so an empty string safely evaluates to NULL (= no rows match the policy predicate).
 *
 * The key pair is derived from `scope` via the shared {@link scopeToRlsKeys}
 * helper so the scope → `(clubId, principalId)` normalisation lives in one
 * place. The parameterised query form prevents any SQL injection through scope values.
 */
async function setRlsSessionVars(client: pg.PoolClient, scope: TransactionScope): Promise<void> {
    const { clubId, principalId } = scopeToRlsKeys(scope);
    // `scopeToRlsKeys` yields `null` for non-applicable keys; `set_config` stores
    // text, so coalesce `null` → `''` with nullish coalescing (not truthiness —
    // an applicable `''` passes through unchanged) for the `nullif(..., '')::uuid`
    // RLS policies.
    await client.query(`SELECT set_config('app.club_id', $1, true)`, [clubId ?? '']);
    // `app.user_id` is set from the context-neutral `PrincipalId` (ADR-0013).
    // The wire name stays `user_id`; only the kernel's TypeScript type is `PrincipalId`.
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [principalId ?? '']);
}

/**
 * Runs `body` inside a PostgreSQL transaction on an already-checked-out
 * `client`: `BEGIN` → `body` → `COMMIT`, with a guarded `ROLLBACK` on error
 * (a `ROLLBACK` after a dead connection would otherwise mask the real error).
 *
 * The client lifecycle (`connect`/`release`) is owned by the caller — this
 * helper owns only the transaction boundary, so it is shared by
 * {@link withTransaction} (which also sets RLS session vars and manages the
 * pool checkout) and `PgPollingDispatcher.processOne` (which checks out its own
 * client via `withClient`). Internal — not part of the kernel's public surface.
 */
export async function runInClientTransaction<T>(
    client: pg.PoolClient,
    body: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    try {
        await client.query('BEGIN');
        const result = await body(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        // ROLLBACK may itself throw when the connection died (the common cause
        // of the original failure); guard it so the real error is preserved.
        try {
            await client.query('ROLLBACK');
        } catch {
            // connection already broken — surface the original error, not this one
        }
        throw err;
    }
}

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `fn`, then commits (or rolls back on error).
 *
 * This is the kernel's single transaction-flow helper for units of work: it
 * owns the connect → {@link runInClientTransaction} (BEGIN → set RLS session
 * vars → `fn` → COMMIT / ROLLBACK) → release flow. {@link withOutboxTransaction}
 * delegates to it, layering the in-memory event accumulator and the atomic
 * outbox write on top by folding them into `fn`. Use this for units of work
 * that do **not** emit domain events; the callback receives only a
 * `pg.PoolClient`.
 */
export async function withTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();
    try {
        return await runInClientTransaction(client, async (c) => {
            await setRlsSessionVars(c, scope);
            return fn(c);
        });
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
    const pending: DomainEvent<unknown>[] = [];
    const appender: OutboxAppender = {
        append(...events) {
            pending.push(...events);
        },
    };

    return withTransaction(pool, scope, async (client) => {
        const result = await fn(client, appender);
        if (pending.length > 0) {
            await writer.write(client, pending, scope);
        }
        return result;
    });
}
