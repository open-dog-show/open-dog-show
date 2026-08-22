// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent, EventScope } from '../domain/domain-event.js';
import { asEventId, asEventType } from '../domain/domain-ids.js';
import { quoteSchemaIdent } from './schema-ident.js';

/**
 * Default number of pending outbox rows one {@link PgPollingDispatcher.poll}
 * cycle processes before returning.  Exposed as a named constant rather than a
 * magic literal so the intent is self-documenting at the call site.
 */
const DEFAULT_DISPATCH_BATCH_SIZE = 10;

/**
 * Called once per outbox row.  Must be idempotent on `event.eventId` because
 * delivery is at-least-once — a crash after handler success but before
 * `dispatched_at` is committed causes redelivery.
 */
export type EventHandler = (event: DomainEvent<unknown>) => Promise<void>;

/**
 * Reads pending outbox rows and delivers them to an {@link EventHandler}.
 *
 * - Each row is processed in its own transaction so a handler failure marks
 *   only that row for retry — already-dispatched rows in the same batch are
 *   not rolled back.
 * - `FOR UPDATE SKIP LOCKED` prevents concurrent dispatcher instances from
 *   processing the same row simultaneously.
 * - `dispatched_at` is set on success; on handler error the single-row
 *   transaction rolls back and the row stays pending for the next poll cycle.
 * - Delivery is at-least-once; the handler is expected to be idempotent on
 *   `event.eventId`.
 */
export class PgPollingDispatcher {
    private readonly quotedSchema: string;

    constructor(
        private readonly pool: pg.Pool,
        schema: string,
        private readonly handler: EventHandler,
    ) {
        this.quotedSchema = quoteSchemaIdent(schema);
    }

    /**
     * Performs one poll cycle: processes up to `batchSize` pending rows, each
     * in its own transaction.  Stops early when no more pending rows exist.
     *
     * @returns the number of events dispatched in this cycle.
     */
    async poll(batchSize: number = DEFAULT_DISPATCH_BATCH_SIZE): Promise<number> {
        let dispatched = 0;

        for (let i = 0; i < batchSize; i++) {
            const processed = await this.processOne();
            if (!processed) {
                break; // No more pending rows in this cycle.
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
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query<OutboxRowRaw>(
                `SELECT seq, event_id, type, occurred_at, scope, aggregate_id, payload
                 FROM ${this.quotedSchema}.outbox
                 WHERE dispatched_at IS NULL
                 ORDER BY seq
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1`,
            );

            if (res.rows.length === 0) {
                await client.query('COMMIT');
                return false;
            }

            const row = res.rows[0]!;
            const event = outboxRowToEvent(row);
            await this.handler(event);
            await client.query(
                `UPDATE ${this.quotedSchema}.outbox SET dispatched_at = NOW() WHERE seq = $1`,
                [row.seq],
            );

            await client.query('COMMIT');
            return true;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
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
    scope: EventScope;
    aggregate_id: string;
    payload: unknown; // pg driver parses JSONB into a JS object
}

/**
 * Maps a raw outbox row to a {@link DomainEvent}.
 *
 * The `pg` driver already yields `occurred_at` as a JS `Date`, so it is passed
 * through directly — no `Date` → ISO-string → `Date` round-trip.  The `eventId`
 * and `type` cross back from untyped database strings into their branded forms
 * via {@link asEventId} / {@link asEventType}; `asEventType` validates the
 * `<context>.<PascalName>` format so a malformed outbox row is rejected at the
 * boundary rather than propagated as a typed event.
 */
function outboxRowToEvent(row: OutboxRowRaw): DomainEvent<unknown> {
    return {
        eventId: asEventId(row.event_id),
        type: asEventType(row.type),
        occurredAt: row.occurred_at,
        scope: row.scope,
        aggregateId: row.aggregate_id,
        payload: row.payload,
    };
}
