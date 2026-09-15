// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent } from '../../domain/domain-event.js';

/**
 * Writes domain events to the outbox within the caller's transaction.
 *
 * Generic over the transaction handle (`TTransaction`) so the port stays
 * infrastructure-agnostic — this kernel's sole implementation,
 * `PgOutboxWriter`, implements it as `OutboxAppender<pg.PoolClient>` without
 * this file importing the `pg` driver. `PgOutboxWriter` writes within the
 * caller-supplied transaction handle, so its write commits or rolls back
 * atomically with the rest of that transaction (ADR-0027: an aggregate root
 * records its own facts; a unit of work pulls and stamps them, then writes
 * them to the outbox immediately before commit) — the port only names that
 * write step and does not itself accumulate events across a transaction the
 * way the pre-#186 `OutboxAppender` did; atomicity is a property of the
 * implementation, not one this interface enforces.
 */
export interface OutboxAppender<TTransaction = unknown> {
    write(transaction: TTransaction, events: readonly DomainEvent[]): Promise<void>;
}
