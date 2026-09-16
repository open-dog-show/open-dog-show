// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent } from '../../domain/domain-event.js';
import {
    rehydrateDomainEvent,
    type DomainEventRehydrationRegistry,
} from './domain-event-rehydration-registry.js';
import { quoteSchemaIdent } from '../persistence/postgres/schema-ident.js';
import { runInClientTransaction } from '../persistence/postgres/with-transaction.js';
import { TransactionFailed } from '../persistence/postgres/transaction-failed.js';
import { OutboxDispatchFailed, type OutboxRowFailureContext } from './outbox-dispatch-failed.js';

/**
 * Default number of pending outbox rows one {@link PgPollingDispatcher.poll}
 * cycle processes before returning.  Exposed as a named constant rather than a
 * magic literal so the intent is self-documenting at the call site.
 */
const DEFAULT_DISPATCH_BATCH_SIZE = 10;

/**
 * Default maximum handler attempts before a pending row is quarantined as a
 * poison pill (skipped by the dispatcher) instead of being retried forever.
 */
const DEFAULT_MAX_ATTEMPTS = 5;

/** Default per-row handler timeout in milliseconds (0 = no timeout). */
const DEFAULT_HANDLER_TIMEOUT_MS = 30_000;

/**
 * Called once per outbox row.  Must be idempotent on `event.eventId` because
 * delivery is at-least-once — a crash after handler success but before
 * `dispatched_at` is committed causes redelivery.  The `signal` is aborted when
 * `handlerTimeoutMs` elapses so the handler can cancel in-flight work; the
 * handler runs outside any transaction or row lock, so a handler that ignores
 * the signal only delays that row's own retry, not other rows or the claim
 * transaction.
 */
export type EventHandler = (event: DomainEvent, signal: AbortSignal) => Promise<void>;

/**
 * Reads pending outbox rows and delivers them to an {@link EventHandler}.
 *
 * - Each row goes through three independent steps: claim (select the row and
 *   increment `attempts`, in one short transaction), run the handler (outside
 *   any transaction or row lock), then record the outcome (`dispatched_at` on
 *   success, `last_error` on failure, each in its own short transaction). The
 *   handler never runs inside the row's lock, so an arbitrary downstream unit
 *   of work it opens is never nested inside the dispatcher's own transaction.
 * - `FOR UPDATE SKIP LOCKED` prevents concurrent dispatcher instances from
 *   selecting the same row simultaneously **only for the brief claim
 *   transaction**: once it commits (incrementing `attempts`) the row's lock
 *   is released and `dispatched_at` is still `NULL`, so a second dispatcher's
 *   poll can select and run the handler on the same row for the rest of the
 *   first instance's handler call — a wider redelivery window than the
 *   previous design, which held the lock for the handler's whole run. This
 *   window permits genuinely *concurrent* re-delivery, not only sequential
 *   retry after a crash: the `event.eventId` idempotency this class already
 *   requires (see {@link EventHandler}) must itself be safe under two
 *   overlapping calls, not merely safe to re-run once the first one finished
 *   — a handler whose idempotency check is a non-atomic read-then-write is
 *   not automatically safe here. In exchange, a crash between claim-commit
 *   and the handler settling leaves the row pending with its `attempts`
 *   already counted, not stuck locked.
 * - `dispatched_at` is set on success, in a second short transaction after the
 *   handler resolves.
 * - Delivery is at-least-once; the handler is expected to be idempotent on
 *   `event.eventId`.
 * - **Poison-pill handling:** a handler that keeps failing is not retried
 *   forever. `attempts` is incremented at claim time — before the handler
 *   runs — so it counts every claimed try, not just failures; a failure also
 *   records `last_error` (in its own short transaction). Rows whose
 *   `attempts` reach `maxAttempts` are skipped (quarantined) so later rows
 *   are not starved.
 * - **Handler timeout:** `handlerTimeoutMs` bounds each handler call (0 = no
 *   timeout) by racing it against a rejection armed by the timeout timer —
 *   not just aborting the signal and awaiting the handler as normal — so a
 *   handler that ignores the signal and later resolves still produces a
 *   recorded failure instead of a silently-late success. The timer also
 *   aborts the handler's `AbortSignal` so a cooperating handler can cancel
 *   its in-flight work.
 * - On a failure attributable to the handler call itself (a handler error,
 *   a timeout, or an unregistered event type) `poll` rethrows
 *   {@link OutboxDispatchFailed} — the batch does not continue past a
 *   failing row, so rows after it are left pending too. A failure while
 *   claiming a row, or while marking a row dispatched after its handler
 *   already succeeded, propagates unwrapped instead, since it is not
 *   attributable to the handler and so not a per-row dispatch failure:
 *   {@link TransactionFailed} for a pool-connect or claim-transaction
 *   `BEGIN`/`COMMIT` failure, the raw driver error otherwise — a query
 *   failure inside the claim transaction body, or in
 *   {@link executeAutocommit}'s single-statement writes, is deliberately
 *   left unwrapped (see {@link runInClientTransaction}).
 */
export class PgPollingDispatcher {
    private readonly pool: pg.Pool;
    private readonly quotedSchema: string;
    private readonly handler: EventHandler;
    private readonly registry: DomainEventRehydrationRegistry;
    private readonly maxAttempts: number;
    private readonly handlerTimeoutMs: number;

    /**
     * @param deps.registry - This context's event-type → class rehydration
     *   registry (built by its composition root). Every row's `type` must be
     *   registered — an unregistered type throws
     *   {@link UnregisteredDomainEventTypeError} rather than delivering a
     *   generic envelope. `instanceof` is then a reliable discriminator for
     *   handlers provided every registered rehydrator actually constructs the
     *   real class (e.g. a context's `XxxSubmitted.rehydrate`) — the registry
     *   itself cannot verify that.
     */
    constructor(deps: {
        readonly pool: pg.Pool;
        readonly schema: string;
        readonly handler: EventHandler;
        readonly registry: DomainEventRehydrationRegistry;
        readonly maxAttempts?: number;
        readonly handlerTimeoutMs?: number;
    }) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- registry is required by the type, but this guards a caller that bypasses tsc (plain JS, or a cast); see the @ts-expect-error test that pins this.
        if (deps.registry === undefined) {
            throw new TypeError('PgPollingDispatcher requires a DomainEventRehydrationRegistry');
        }
        this.pool = deps.pool;
        this.quotedSchema = quoteSchemaIdent(deps.schema);
        this.handler = deps.handler;
        this.registry = deps.registry;
        this.maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        this.handlerTimeoutMs = deps.handlerTimeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS;
    }

    /**
     * Performs one poll cycle: processes up to `batchSize` pending rows.
     * Stops early when no more pending rows exist. If a row fails to
     * dispatch, `poll` rethrows immediately; remaining rows are left for a
     * subsequent poll cycle, and `quarantined` is not computed for this
     * cycle.
     *
     * @returns `dispatched` — the number of events dispatched in this cycle;
     *   `quarantined` — the number of pending rows currently at
     *   `maxAttempts`, excluded from `selectNextRow`'s predicate and
     *   otherwise invisible to a caller.
     */
    async poll(
        batchSize: number = DEFAULT_DISPATCH_BATCH_SIZE,
    ): Promise<{ readonly dispatched: number; readonly quarantined: number }> {
        let dispatched = 0;

        for (let i = 0; i < batchSize; i++) {
            const processed = await this.processOne();
            if (!processed) {
                break;
            }
            dispatched++;
        }

        const quarantined = await this.countQuarantinedRows();
        return { dispatched, quarantined };
    }

    /**
     * Counts pending rows currently excluded from dispatch by
     * {@link selectNextRow}'s `attempts < maxAttempts` predicate — poison
     * pills quarantined after repeated handler failures.
     */
    private async countQuarantinedRows(): Promise<number> {
        return this.withClient(async (client) => {
            const res = await client.query<{ count: string }>(
                `SELECT COUNT(*) AS count
                 FROM ${this.quotedSchema}.outbox
                 WHERE dispatched_at IS NULL AND attempts >= $1`,
                [this.maxAttempts],
            );
            return Number(res.rows[0]?.count ?? 0);
        });
    }

    /**
     * Processes a single pending outbox row across its three independent
     * steps — claim, run handler, record outcome. Returns `true` when a row
     * was dispatched, `false` when no pending row was found (so {@link poll}
     * can stop the loop early).
     *
     * A failure while claiming (e.g. a connection fault) propagates as-is —
     * no row was durably claimed, so it is not a per-row dispatch failure.
     * Once claimed, any failure (handler error, timeout, or unregistered
     * event type) is recorded and rethrown as {@link OutboxDispatchFailed}.
     */
    private async processOne(): Promise<boolean> {
        const claimed = await this.claimNextRow();
        if (claimed === undefined) return false;

        const { row, attempts } = claimed;
        try {
            await this.runHandler(row);
        } catch (cause) {
            throw await this.recordDispatchFailure({
                seq: row.seq,
                eventId: row.event_id,
                type: row.type,
                attempts,
                cause,
            });
        }
        await this.markDispatched(row.seq);
        return true;
    }

    /**
     * Selects and locks the next eligible pending row, or `undefined` when
     * none is available to this worker. `FOR UPDATE SKIP LOCKED` skips a head
     * row already locked by a concurrent dispatcher and continues with the
     * next available row instead of stopping the poll early; skipping
     * `attempts >= maxAttempts` quarantines poison pills so a
     * permanently-failing row cannot starve later rows. Must be called inside
     * the claim transaction ({@link claimNextRow}'s `runInClientTransaction`).
     */
    private async selectNextRow(client: pg.PoolClient): Promise<OutboxRowRaw | undefined> {
        const res = await client.query<OutboxRowRaw>(
            `SELECT seq, event_id, type, occurred_at, scope, club_id, user_id, aggregate_id, payload
             FROM ${this.quotedSchema}.outbox
             WHERE dispatched_at IS NULL AND attempts < $1
             ORDER BY seq
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
            [this.maxAttempts],
        );
        return res.rows[0];
    }

    /**
     * Selects and locks the next eligible pending row and increments its
     * `attempts`, committing before the handler ever runs — so the row is
     * durably counted as claimed, and its lock released, as soon as this
     * short transaction commits. Returns `undefined` when no row is
     * available to this worker.
     */
    private async claimNextRow(): Promise<
        { readonly row: OutboxRowRaw; readonly attempts: number } | undefined
    > {
        return this.withClient((client) =>
            runInClientTransaction(client, async (c) => {
                const row = await this.selectNextRow(c);
                if (row === undefined) return undefined;

                const { rows } = await c.query<{ attempts: number }>(
                    `UPDATE ${this.quotedSchema}.outbox
                     SET attempts = attempts + 1
                     WHERE seq = $1
                     RETURNING attempts`,
                    [row.seq],
                );
                const attempts = rows[0]?.attempts;
                if (attempts === undefined) {
                    // `selectNextRow` just locked this exact row inside this
                    // same transaction — it cannot have vanished before this
                    // UPDATE runs.
                    throw new Error(`outbox row ${row.seq} vanished during claim`);
                }
                return { row, attempts };
            }),
        );
    }

    /**
     * Rehydrates `row` and delivers it to the handler, bounded by
     * `handlerTimeoutMs` (0 = no timeout). Runs outside any transaction or
     * row lock — the row was already claimed by {@link claimNextRow}.
     */
    private async runHandler(row: OutboxRowRaw): Promise<void> {
        const event = this.rowToEvent(row);
        const controller = new AbortController();
        if (this.handlerTimeoutMs <= 0) {
            await this.handler(event, controller.signal);
            return;
        }
        await this.raceAgainstTimeout(this.handler(event, controller.signal), controller, row);
    }

    /**
     * Races `handlerCall` against a rejection armed by `handlerTimeoutMs`,
     * aborting `controller`'s signal when the timer fires so a cooperating
     * handler can cancel its in-flight work — and so a handler that ignores
     * the signal and later resolves still loses the race, producing a
     * failure here rather than a silently-late success. `handlerCall` is
     * already running by the time it's passed in here — the timer and abort
     * listener arm at this method's own entry, a few synchronous statements
     * after the handler call started, so only work the handler does after
     * its own first `await` is actually bounded by this clock.
     */
    private async raceAgainstTimeout(
        handlerCall: Promise<void>,
        controller: AbortController,
        row: OutboxRowRaw,
    ): Promise<void> {
        const timeoutRejection = new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener('abort', () => {
                reject(
                    new Error(
                        `handler timed out after ${String(this.handlerTimeoutMs)}ms for event '${row.event_id}' (type '${row.type}')`,
                    ),
                );
            });
        });
        const timer = setTimeout(() => {
            controller.abort();
        }, this.handlerTimeoutMs);
        try {
            await Promise.race([handlerCall, timeoutRejection]);
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Marks `seq` dispatched, in its own short transaction after the handler
     * has already resolved successfully — decoupled from both the claim
     * transaction and the handler call itself.
     */
    private async markDispatched(seq: string): Promise<void> {
        await this.executeAutocommit(
            `UPDATE ${this.quotedSchema}.outbox SET dispatched_at = NOW() WHERE seq = $1`,
            [seq],
        );
    }

    /**
     * Checks out a client, fires one statement outside any transaction
     * (autocommitting), and releases the client — the shared shape behind
     * {@link markDispatched} and {@link recordDispatchFailure}'s write. Unlike
     * {@link claimNextRow}, a failure here is never wrapped as
     * {@link TransactionFailed} — only `pool.connect()` itself is; the query
     * propagates as whatever the driver throws (see the class doc's failure
     * bullet).
     */
    private async executeAutocommit(sql: string, params: readonly unknown[]): Promise<void> {
        await this.withClient((client) => client.query(sql, params as unknown[]));
    }

    /**
     * Records a per-row dispatch failure (handler error, timeout, or an
     * unregistered event type) by setting `last_error` — `attempts` was
     * already incremented at claim time, so recording a failure only needs
     * to record the message, in its own short transaction. A failure in
     * *this* recording is not silently swallowed — it is captured and
     * returned on the built {@link OutboxDispatchFailed}'s `cause.recordingError`
     * rather than discarded.
     */
    private async recordDispatchFailure(
        failure: OutboxRowFailureContext & { readonly cause: unknown },
    ): Promise<OutboxDispatchFailed> {
        const { seq, eventId, type, attempts, cause } = failure;
        let recordingError: unknown;
        try {
            await this.executeAutocommit(
                `UPDATE ${this.quotedSchema}.outbox SET last_error = $2 WHERE seq = $1`,
                [seq, String(cause)],
            );
        } catch (recErr) {
            recordingError = recErr;
        }

        return new OutboxDispatchFailed({ seq, eventId, type, attempts, cause, recordingError });
    }

    /**
     * Checks out a client from the pool, runs `body` on it, and always returns
     * the client to the pool — even when `body` throws — so no client is leaked.
     * The transaction lifecycle (`BEGIN`/`COMMIT`/`ROLLBACK`) stays in `body`
     * because {@link claimNextRow} needs `FOR UPDATE SKIP LOCKED` mid-transaction.
     */
    private async withClient<T>(body: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        let client: pg.PoolClient;
        try {
            client = await this.pool.connect();
        } catch (cause) {
            throw new TransactionFailed('connecting to the pool', cause);
        }
        try {
            return await body(client);
        } finally {
            client.release();
        }
    }

    /**
     * Maps a raw outbox row to a {@link DomainEvent} by delegating the boundary
     * casts (and the `occurredAt` `Date` pass-through) to the shared
     * {@link rehydrateDomainEvent} helper, so the row mapper and the JSON codec
     * share one rehydration path. The row is always rehydrated into its
     * concrete class event via the constructor's registry; a row whose `type`
     * is not registered throws (see {@link rehydrateDomainEvent}).
     */
    private rowToEvent(row: OutboxRowRaw): DomainEvent {
        return rehydrateDomainEvent(
            {
                eventId: row.event_id,
                type: row.type,
                occurredAt: row.occurred_at,
                scope: row.scope,
                clubId: row.club_id,
                principalId: row.user_id,
                aggregateId: row.aggregate_id,
                payload: row.payload,
            },
            this.registry,
        );
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface OutboxRowRaw {
    seq: string; // BIGSERIAL — pg returns bigint columns as strings
    event_id: string;
    type: string;
    occurred_at: Date; // pg driver parses TIMESTAMPTZ into a JS Date
    scope: string; // raw text — validated to EventScope by asEventScope
    club_id: string | null;
    user_id: string | null;
    aggregate_id: string;
    payload: unknown; // pg driver parses JSONB into a JS object
}
