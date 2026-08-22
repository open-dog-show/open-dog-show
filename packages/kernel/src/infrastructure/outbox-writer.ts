// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent } from '../domain/domain-event.js';
import type { TransactionScope } from '../domain/transaction-scope.js';

/**
 * Writes queued domain events to the outbox table within the current
 * PostgreSQL transaction.
 *
 * The scope columns (`tenant_id`, `user_id`) are flattened from the
 * transaction scope so the dispatcher can route events by owner without
 * re-parsing the payload.
 *
 * Implementations are schema-scoped — one instance per bounded context.
 */
export interface OutboxWriter {
    write(
        client: pg.PoolClient,
        events: DomainEvent<unknown>[],
        scope: TransactionScope,
    ): Promise<void>;
}
