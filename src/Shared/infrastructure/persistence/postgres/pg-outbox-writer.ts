// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { DomainEvent } from '../../../domain/domain-event.js';
import type { EventScope } from '../../../domain/event-scope.js';
import type { ClubId, PrincipalId } from '../../../domain/domain-ids.js';
import { quoteSchemaIdent } from './schema-ident.js';
import { OutboxWriteFailed } from './outbox-write-failed.js';

/**
 * Derives the outbox owner columns from an event's own {@link EventScope}
 * (ADR-0027) — not from the acting `TransactionScope`. An exhibitor-acting
 * transaction that records a `club(clubId)` fact (a hybrid aggregate) still
 * writes that `clubId`, because it comes from the event, not from who was
 * acting when it happened.
 */
function eventOwnerColumns(scope: EventScope): {
    clubId: ClubId | null;
    principalId: PrincipalId | null;
} {
    switch (scope.kind) {
        case 'club':
            return { clubId: scope.clubId, principalId: null };
        case 'exhibitor':
            return { clubId: null, principalId: scope.principalId };
        case 'platform':
            return { clubId: null, principalId: null };
        default:
            // Exhaustiveness guard: a future EventScope variant added without a
            // case here fails to compile, mirroring rls-keys.ts's scopeToRlsKeys.
            return assertNever(scope);
    }
}

/** Compile-time exhaustiveness check for an unreachable `never` branch. */
function assertNever(value: never): never {
    throw new Error(`Unexpected EventScope kind: ${String(value)}`);
}

/**
 * Writes domain events to a per-schema outbox table within the current
 * PostgreSQL transaction. The sole implementation — no port interface, no
 * fake (ADR-0027): a real Postgres instance is used in tests.
 *
 * Expects a table in `<schema>.outbox` with columns:
 *   `event_id` UUID UNIQUE, `type` TEXT, `occurred_at` TIMESTAMPTZ,
 *   `scope` TEXT, `club_id` UUID, `user_id` UUID,
 *   `aggregate_id` TEXT, `payload` JSONB, `dispatched_at` TIMESTAMPTZ
 *
 * The `ON CONFLICT (event_id) DO NOTHING` guard makes writes idempotent so
 * retrying the same unit-of-work attempt does not create duplicate outbox
 * rows. **Important:** idempotency only holds when the **same `DomainEvent`
 * object** (with its original `eventId`) is replayed. A caller retry of the
 * unit-of-work *body* records fresh facts with new ids (ADR-0027) — body
 * replays are not idempotent at the outbox, and consumers must tolerate
 * at-least-once delivery regardless.
 */
export class PgOutboxWriter {
    private readonly quotedSchema: string;

    constructor(schema: string) {
        this.quotedSchema = quoteSchemaIdent(schema);
    }

    async write(client: pg.PoolClient, events: readonly DomainEvent[]): Promise<void> {
        for (const event of events) {
            // `eventOwnerColumns` yields `null` for the non-applicable owner
            // column and the actual id otherwise, so bind the values directly
            // — nullability is a function of `event.scope.kind`, never of
            // string truthiness, and an applicable-but-empty id is bound and
            // rejected by PostgreSQL as an invalid UUID.
            const { clubId, principalId } = eventOwnerColumns(event.scope);

            try {
                await client.query(
                    `INSERT INTO ${this.quotedSchema}.outbox
                       (event_id, type, occurred_at, scope, club_id, user_id,
                        aggregate_id, payload)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (event_id) DO NOTHING`,
                    [
                        event.eventId,
                        event.type,
                        event.occurredAt.toISOString(),
                        event.scope.kind,
                        clubId,
                        // Bound to the `user_id` column; the wire name is unchanged
                        // (ADR-0005), only the kernel's TS type is `PrincipalId` (ADR-0013).
                        principalId,
                        event.aggregateId,
                        JSON.stringify(event.payload),
                    ],
                );
            } catch (cause) {
                // E3: wrap the raw `pg` exception at the infrastructure boundary
                // so no outer-circle exception type crosses inward; the original
                // is preserved on `cause` for the boundary handler to log.
                throw new OutboxWriteFailed('writing an outbox event', cause);
            }
        }
    }
}
