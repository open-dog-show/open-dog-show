// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { Clock, EventIdGenerator } from '../../../domain/domain-ports.js';
import {
    stampDomainEvent,
    type DomainEvent,
    type DomainEventFact,
} from '../../../domain/domain-event.js';
import type { TransactionScope } from '../../../domain/transaction-scope.js';
import { scopeToRlsKeys } from './rls-keys.js';
import { PgOutboxWriter } from './pg-outbox-writer.js';
import { TransactionFailed } from './transaction-failed.js';

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
 * `BEGIN` and `COMMIT` failures are wrapped as {@link TransactionFailed} (E3);
 * a `body` error (a business failure or a test's simulated failure) is
 * deliberately left unwrapped — it is not a transaction-plumbing fault.
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
    } catch (cause) {
        throw new TransactionFailed('beginning the transaction', cause);
    }

    let result: T;
    try {
        result = await body(client);
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

    try {
        await client.query('COMMIT');
    } catch (cause) {
        throw new TransactionFailed('committing the transaction', cause);
    }
    return result;
}

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `fn`, then commits (or rolls back on error).
 *
 * This is the kernel's single transaction-flow helper for units of work: it
 * owns the connect → {@link runInClientTransaction} (BEGIN → set RLS session
 * vars → `fn` → COMMIT / ROLLBACK) → release flow. {@link withOutboxTransaction}
 * delegates to it, layering the fact-stamping and the atomic outbox write on
 * top by folding them into `fn`. Use this for units of work that do **not**
 * emit domain events; the callback receives only a `pg.PoolClient`.
 *
 * `pool.connect()` and setting the RLS session variables are wrapped as
 * {@link TransactionFailed} (E3), alongside `BEGIN`/`COMMIT` (wrapped by
 * {@link runInClientTransaction}).
 */
export async function withTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch (cause) {
        throw new TransactionFailed('connecting to the pool', cause);
    }
    try {
        return await runInClientTransaction(client, async (c) => {
            try {
                await setRlsSessionVars(c, scope);
            } catch (cause) {
                throw new TransactionFailed('setting RLS session variables', cause);
            }
            return fn(c);
        });
    } finally {
        client.release();
    }
}

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `fn`, then atomically writes any recorded domain facts via `writer`
 * before committing (or rolls back on error).
 *
 * Use this for units of work that emit domain events. `fn` receives
 * `(client, record)`: `record(...facts)` stamps each {@link DomainEventFact}
 * with a fresh `eventId` / `occurredAt` (from `eventIdGenerator` / `clock`)
 * and queues the resulting {@link DomainEvent} for the outbox write —
 * mirroring ADR-0027's "the unit of work pulls events from aggregates,
 * stamps the envelope" (a context's own unit-of-work implementation calls
 * `record(...aggregate.pullEvents())` after saving the aggregate). Events are
 * written to the outbox table in the same transaction, immediately before
 * `COMMIT`. On rollback neither the aggregate change nor the outbox rows are
 * persisted.
 */
export async function withOutboxTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    writer: PgOutboxWriter,
    clock: Clock,
    eventIdGenerator: EventIdGenerator,
    fn: (
        client: pg.PoolClient,
        record: (...facts: readonly DomainEventFact[]) => void,
    ) => Promise<T>,
): Promise<T> {
    const pending: DomainEvent[] = [];
    const record = (...facts: readonly DomainEventFact[]): void => {
        for (const fact of facts) {
            pending.push(stampDomainEvent(fact, eventIdGenerator.generate(), clock.now()));
        }
    };

    return withTransaction(pool, scope, async (client) => {
        const result = await fn(client, record);
        if (pending.length > 0) {
            await writer.write(client, pending);
        }
        return result;
    });
}
