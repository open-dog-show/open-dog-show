// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent } from '../domain/domain-event.js';
import {
    rehydrateDomainEvent,
    type DomainEventRehydrationRegistry,
} from '../domain/domain-event-codec.js';
import { quoteSchemaIdent } from './schema-ident.js';
import { runInClientTransaction } from './with-transaction.js';

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
 * dispatch transaction holds the row lock until the handler settles.
 */
export type EventHandler = (event: DomainEvent, signal: AbortSignal) => Promise<void>;

/**
 * Reads pending outbox rows and delivers them to an {@link EventHandler}.
 *
 * - Each row is processed in its own transaction so a handler failure marks
 *   only that row for retry — already-dispatched rows in the same batch are
 *   not rolled back.
 * - `FOR UPDATE SKIP LOCKED` prevents concurrent dispatcher instances from
 *   processing the same row simultaneously.
 * - `dispatched_at` is set on success.
 * - Delivery is at-least-once; the handler is expected to be idempotent on
 *   `event.eventId`.
 * - **Poison-pill handling:** a handler that keeps failing is not retried
 *   forever. Each failure increments the row's `attempts` and records
 *   `last_error` (in a separate short transaction after the dispatch
 *   transaction rolls back); rows whose `attempts` reach `maxAttempts` are
 *   skipped (quarantined) so later rows are not starved.
 * - **Handler timeout:** `handlerTimeoutMs` bounds each handler call (0 = no
 *   timeout); on timeout the handler's `AbortSignal` is aborted and the call is
 *   treated as a handler failure (attempt incremented). The row lock is held
 *   until the handler settles, so a timed-out handler must honour the signal.
 * - On a handler error `poll` rethrows — the batch does not continue past a
 *   failing row, so rows after it are left pending too.
 */
export class PgPollingDispatcher {
    private readonly quotedSchema: string;
    private readonly maxAttempts: number;
    private readonly handlerTimeoutMs: number;

    /**
     * @param registry - This context's event-type → class rehydration
     *   registry (built by its composition root). Every row's `type` must be
     *   registered — an unregistered type throws
     *   {@link UnregisteredDomainEventTypeError} rather than delivering a
     *   generic envelope. `instanceof` is then a reliable discriminator for
     *   handlers provided every registered rehydrator actually constructs the
     *   real class (e.g. a context's `XxxSubmitted.rehydrate`) — the registry
     *   itself cannot verify that.
     */
    constructor(
        private readonly pool: pg.Pool,
        schema: string,
        private readonly handler: EventHandler,
        private readonly registry: DomainEventRehydrationRegistry,
        options?: {
            readonly maxAttempts?: number;
            readonly handlerTimeoutMs?: number;
        },
    ) {
        if (registry === undefined) {
            throw new TypeError('PgPollingDispatcher requires a DomainEventRehydrationRegistry');
        }
        this.quotedSchema = quoteSchemaIdent(schema);
        this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        this.handlerTimeoutMs = options?.handlerTimeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS;
    }

    /**
     * Performs one poll cycle: processes up to `batchSize` pending rows, each
     * in its own transaction.  Stops early when no more pending rows exist.
     * If a row's handler throws, `poll` rethrows immediately after rolling
     * back that row's transaction; remaining rows are left for a subsequent
     * poll cycle.
     *
     * @returns the number of events dispatched in this cycle.
     */
    async poll(batchSize: number = DEFAULT_DISPATCH_BATCH_SIZE): Promise<number> {
        let dispatched = 0;

        for (let i = 0; i < batchSize; i++) {
            const processed = await this.processOne();
            if (!processed) {
                break;
            }
            dispatched++;
        }

        return dispatched;
    }

    /**
     * Processes a single pending outbox row in its own transaction:
     *
     *   SELECT … `FOR UPDATE SKIP LOCKED` `LIMIT 1` → handler →
     *   `dispatched_at` UPDATE → commit.
     *
     * On handler error the transaction rolls back and the row stays pending for
     * the next poll cycle.  Returns `true` when a row was dispatched, `false`
     * when no pending row was found (so {@link poll} can stop the loop early).
     */
    private async processOne(): Promise<boolean> {
        return this.withClient(async (client) => {
            // The next eligible row is selected and locked in one query inside the
            // dispatch transaction below, so `FOR UPDATE SKIP LOCKED` skips a head
            // row already locked by a concurrent dispatcher and continues with the
            // next available row instead of stopping the poll early. `seq` is
            // captured into the outer scope so the failure-recording transaction
            // (run after the dispatch transaction rolls back) can target the same
            // row. Skipping `attempts >= maxAttempts` quarantines poison pills so a
            // permanently-failing row cannot starve later rows.
            let seq: string | undefined;

            try {
                return await runInClientTransaction(client, async (c) => {
                    const res = await c.query<OutboxRowRaw>(
                        `SELECT seq, event_id, type, occurred_at, scope, aggregate_id, payload
                         FROM ${this.quotedSchema}.outbox
                         WHERE dispatched_at IS NULL AND attempts < $1
                         ORDER BY seq
                         FOR UPDATE SKIP LOCKED
                         LIMIT 1`,
                        [this.maxAttempts],
                    );
                    const [row] = res.rows;
                    if (row === undefined) return false; // no eligible row available to this worker
                    seq = row.seq;

                    const event = this.rowToEvent(row);
                    // Abort the handler on timeout so it can cancel in-flight I/O.
                    // The row lock is held until the handler settles — the signal
                    // is the only cancellation path (see `handlerTimeoutMs`).
                    const controller = new AbortController();
                    const timer =
                        this.handlerTimeoutMs > 0
                            ? setTimeout(() => controller.abort(), this.handlerTimeoutMs)
                            : undefined;
                    try {
                        await this.handler(event, controller.signal);
                    } finally {
                        if (timer !== undefined) clearTimeout(timer);
                    }
                    await c.query(
                        `UPDATE ${this.quotedSchema}.outbox SET dispatched_at = NOW() WHERE seq = $1`,
                        [row.seq],
                    );
                    return true;
                });
            } catch (err) {
                // Handler failed (or aborted on timeout): the dispatch transaction
                // rolled back, so the row stays pending. Record the failure in a
                // separate short transaction (attempts + last_error) so the row is
                // eventually skipped as a poison pill instead of retried forever.
                // Best-effort: a recording failure must not mask the original error.
                if (seq !== undefined) {
                    await runInClientTransaction(client, async (c) => {
                        await c.query(
                            `UPDATE ${this.quotedSchema}.outbox
                             SET attempts = attempts + 1, last_error = $2
                             WHERE seq = $1`,
                            [seq, String(err)],
                        );
                    }).catch(() => {
                        // best-effort failure recording — surface the original error below
                    });
                }
                throw err;
            }
        });
    }

    /**
     * Checks out a client from the pool, runs `body` on it, and always returns
     * the client to the pool — even when `body` throws — so no client is leaked.
     * The transaction lifecycle (`BEGIN`/`COMMIT`/`ROLLBACK`) stays in `body`
     * because {@link processOne} needs `FOR UPDATE SKIP LOCKED` mid-transaction.
     */
    private async withClient<T>(body: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
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
    aggregate_id: string;
    payload: unknown; // pg driver parses JSONB into a JS object
}
