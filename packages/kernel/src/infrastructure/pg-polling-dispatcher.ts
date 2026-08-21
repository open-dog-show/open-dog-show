// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent, EventScope } from '../domain/domain-event.js';
import { decodeDomainEvent } from '../domain/domain-event-codec.js';

const DEFAULT_BATCH_SIZE = 10;

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
        this.quotedSchema = `"${schema.replaceAll('"', '""')}"`;
    }

    /**
     * Performs one poll cycle: processes up to `batchSize` pending rows, each
     * in its own transaction.  Stops early when no more pending rows exist.
     *
     * @returns the number of events dispatched in this cycle.
     */
    async poll(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
        let dispatched = 0;

        for (let i = 0; i < batchSize; i++) {
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
                    break; // No more pending rows in this cycle.
                }

                const row = res.rows[0]!;
                const event = outboxRowToEvent(row);
                await this.handler(event);
                await client.query(
                    `UPDATE ${this.quotedSchema}.outbox SET dispatched_at = NOW() WHERE seq = $1`,
                    [row.seq],
                );

                await client.query('COMMIT');
                dispatched++;
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }

        return dispatched;
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

function outboxRowToEvent(row: OutboxRowRaw): DomainEvent<unknown> {
    return decodeDomainEvent({
        eventId: row.event_id,
        type: row.type,
        occurredAt: row.occurred_at.toISOString(),
        scope: row.scope,
        aggregateId: row.aggregate_id,
        payload: row.payload,
    });
}
