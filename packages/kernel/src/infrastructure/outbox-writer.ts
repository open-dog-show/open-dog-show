// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent } from '../domain/domain-event.js';
import type { TransactionScope } from '../domain/transaction-scope.js';

/**
 * Infrastructure contract between {@link withOutboxTransaction} and a
 * schema-scoped outbox table implementation.
 *
 * This is **not** a domain port — it carries a `pg.PoolClient` dependency
 * and belongs exclusively in the infrastructure layer.  The domain-layer
 * equivalent is {@link OutboxAppender}, which accumulates events without
 * knowing about the transport.
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
