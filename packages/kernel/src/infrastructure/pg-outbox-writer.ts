// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent } from '../domain/domain-event.js';
import type { OutboxWriter } from './outbox-writer.js';
import type { TransactionScope } from '../domain/transaction-scope.js';
import { scopeToRlsKeys } from './rls-keys.js';
import { quoteSchemaIdent } from './schema-ident.js';

/**
 * Writes domain events to a per-schema outbox table within the current
 * PostgreSQL transaction.
 *
 * Expects a table in `<schema>.outbox` with columns:
 *   `event_id` UUID UNIQUE, `type` TEXT, `occurred_at` TIMESTAMPTZ,
 *   `scope` TEXT, `tenant_id` UUID, `user_id` UUID,
 *   `aggregate_id` TEXT, `payload` JSONB, `dispatched_at` TIMESTAMPTZ
 *
 * The `ON CONFLICT (event_id) DO NOTHING` guard makes writes idempotent so
 * retrying the same unit-of-work does not create duplicate outbox rows.
 * **Important:** idempotency only holds when the **same `DomainEvent`
 * object** (with its original `eventId`) is replayed.  A freshly
 * constructed event carries a new `eventId`; the conflict guard offers
 * no protection in that case.
 */
export class PgOutboxWriter implements OutboxWriter {
    private readonly quotedSchema: string;

    constructor(schema: string) {
        this.quotedSchema = quoteSchemaIdent(schema);
    }

    async write(
        client: pg.PoolClient,
        events: DomainEvent<unknown>[],
        scope: TransactionScope,
    ): Promise<void> {
        const { tenantId, userId } = scopeToRlsKeys(scope);
        // The nullable `tenant_id` / `user_id` columns want NULL for the
        // non-applicable keys; `scopeToRlsKeys` represents those as the empty
        // string, so collapse `''` → NULL before binding.
        const tenantIdOrNull = tenantId || null;
        const userIdOrNull = userId || null;

        for (const event of events) {
            await client.query(
                `INSERT INTO ${this.quotedSchema}.outbox
                   (event_id, type, occurred_at, scope, tenant_id, user_id,
                    aggregate_id, payload)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (event_id) DO NOTHING`,
                [
                    event.eventId,
                    event.type,
                    event.occurredAt.toISOString(),
                    event.scope,
                    tenantIdOrNull,
                    userIdOrNull,
                    event.aggregateId,
                    JSON.stringify(event.payload),
                ],
            );
        }
    }
}
