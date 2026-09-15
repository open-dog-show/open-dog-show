// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent } from '../../domain/domain-event.js';

/**
 * Writes domain events to the outbox within the caller's transaction.
 *
 * Generic over the transaction handle (`TTransaction`) so the port stays
 * infrastructure-agnostic — this kernel's sole implementation,
 * `PgOutboxWriter`, implements it as `OutboxAppender<pg.PoolClient>` without
 * this file importing the `pg` driver. The write is atomic with the
 * caller's transaction (ADR-0027: an aggregate root records its own facts;
 * a unit of work pulls and stamps them, then writes them to the outbox
 * immediately before commit) — this port names that write step, it does not
 * itself accumulate events across a transaction the way the pre-#186
 * `OutboxAppender` did.
 */
export interface OutboxAppender<TTransaction = unknown> {
    write(transaction: TTransaction, events: readonly DomainEvent[]): Promise<void>;
}
