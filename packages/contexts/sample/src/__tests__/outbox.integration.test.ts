// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresHarness, runMigrations } from '@ods/test-kit';
import {
    withOutboxTransaction,
    asAggregateId,
    asClubId,
    asPrincipalId,
    asEventId,
    asEventType,
    createDomainEvent,
    FakeClock,
    FakeEventIdGenerator,
    PgOutboxWriter,
    PgPollingDispatcher,
    type DomainEvent,
} from '@ods/kernel';
import { DrizzleEntryRepository } from '../infrastructure/drizzle-entry-repository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fixed deterministic IDs.
const CLUB_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000011';
const SHOW_ID = '00000000-0000-4000-8000-000000000021';
const ENTRY_ID = '00000000-0000-4000-8000-000000000031';
const EVENT_ID = '00000000-0000-4000-8000-000000000041';

const scope = {
    kind: 'club' as const,
    clubId: asClubId(CLUB_ID),
    principalId: asPrincipalId(USER_ID),
};
const entry = {
    id: ENTRY_ID,
    clubId: asClubId(CLUB_ID),
    principalId: asPrincipalId(USER_ID),
    showId: SHOW_ID,
    dogName: 'Fido',
};

describe('Transactional outbox — sample context', () => {
    const harness = new PostgresHarness();
    let superPool: pg.Pool;
    let appPool: pg.Pool;

    beforeAll(async () => {
        await harness.start();

        await runMigrations(harness.connectionUrl, [
            {
                name: 'sample',
                migrationsDir: resolve(__dirname, '../infrastructure/migrations'),
            },
        ]);

        superPool = new pg.Pool({ connectionString: harness.connectionUrl });

        const appUserUrl = harness.connectionUrl.replace(
            /\/\/[^:]+:[^@]+@/,
            '//app_user:app_user@',
        );
        appPool = new pg.Pool({ connectionString: appUserUrl });

        // Seed a show (foreign-key target for entries).
        const superClient = new pg.Client({ connectionString: harness.connectionUrl });
        await superClient.connect();
        try {
            await superClient.query(
                `INSERT INTO sample.shows (id, club_id, name) VALUES ($1, $2, $3)`,
                [SHOW_ID, CLUB_ID, 'Outbox Test Show'],
            );
        } finally {
            await superClient.end();
        }
    }, 120_000);

    afterAll(async () => {
        await superPool?.end();
        await appPool?.end();
        await harness.stop();
    });

    function makeEvent(): DomainEvent<unknown> {
        return createDomainEvent(
            {
                type: asEventType('sample.EntrySubmitted'),
                scope: 'club',
                aggregateId: asAggregateId(ENTRY_ID),
                payload: { dogName: 'Fido' },
                eventId: asEventId(EVENT_ID),
            },
            {
                clock: new FakeClock(new Date('2026-08-01T12:00:00.000Z')),
                eventIdGenerator: new FakeEventIdGenerator(),
            },
        );
    }

    const outboxWriter = new PgOutboxWriter('sample');

    // -------------------------------------------------------------------------
    // Seam 1: same-transaction write
    // -------------------------------------------------------------------------

    describe('same-transaction write', () => {
        it('rolls back both the entry and the outbox row when the transaction fails', async () => {
            await expect(
                withOutboxTransaction(appPool, scope, outboxWriter, async (client, outbox) => {
                    const repo = new DrizzleEntryRepository(client);
                    await repo.save(entry);
                    outbox.append(makeEvent());
                    throw new Error('simulated failure');
                }),
            ).rejects.toThrow('simulated failure');

            const { rows: entryRows } = await superPool.query(
                `SELECT id FROM sample.entries WHERE id = $1`,
                [ENTRY_ID],
            );
            expect(entryRows).toHaveLength(0);

            const { rows: outboxRows } = await superPool.query(
                `SELECT event_id FROM sample.outbox WHERE event_id = $1`,
                [EVENT_ID],
            );
            expect(outboxRows).toHaveLength(0);
        });

        it('writes both the entry and the outbox row when the transaction succeeds', async () => {
            await withOutboxTransaction(appPool, scope, outboxWriter, async (client, outbox) => {
                const repo = new DrizzleEntryRepository(client);
                await repo.save(entry);
                outbox.append(makeEvent());
            });

            const { rows: entryRows } = await superPool.query(
                `SELECT id FROM sample.entries WHERE id = $1`,
                [ENTRY_ID],
            );
            expect(entryRows).toHaveLength(1);

            const { rows: outboxRows } = await superPool.query(
                `SELECT event_id, club_id, dispatched_at FROM sample.outbox WHERE event_id = $1`,
                [EVENT_ID],
            );
            expect(outboxRows).toHaveLength(1);
            expect(outboxRows[0]?.club_id).toBe(CLUB_ID);
            expect(outboxRows[0]?.dispatched_at).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Seam 2: dispatcher round-trip
    // -------------------------------------------------------------------------

    // A distinct event ID for dispatcher tests so they are fully self-contained
    // and do not share state with the same-transaction write tests above.
    const DISPATCHER_EVENT_ID = '00000000-0000-4000-8000-000000000042';

    describe('polling dispatcher', () => {
        beforeEach(async () => {
            // Start each dispatcher test from a clean, known-pending row.
            await superPool.query(`DELETE FROM sample.outbox`);
            await superPool.query(
                `INSERT INTO sample.outbox
                   (event_id, type, occurred_at, scope, aggregate_id, payload)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    DISPATCHER_EVENT_ID,
                    'sample.EntrySubmitted',
                    '2026-08-01T12:00:00.000Z',
                    'club',
                    ENTRY_ID,
                    JSON.stringify({ dogName: 'Fido' }),
                ],
            );
        });

        it('delivers the pending outbox row to the handler and marks it dispatched', async () => {
            const received: string[] = [];
            const dispatcher = new PgPollingDispatcher(superPool, 'sample', async (event) => {
                received.push(event.eventId);
            });

            const count = await dispatcher.poll();

            expect(count).toBe(1);
            expect(received).toEqual([DISPATCHER_EVENT_ID]);

            const { rows } = await superPool.query(
                `SELECT dispatched_at FROM sample.outbox WHERE event_id = $1`,
                [DISPATCHER_EVENT_ID],
            );
            expect(rows[0]?.dispatched_at).not.toBeNull();
        });

        it('returns 0 when there are no pending rows', async () => {
            // Dispatch the row seeded by beforeEach, then poll again.
            await new PgPollingDispatcher(superPool, 'sample', async () => {}).poll();
            const dispatcher = new PgPollingDispatcher(superPool, 'sample', async () => {});
            const count = await dispatcher.poll();
            expect(count).toBe(0);
        });

        // -----------------------------------------------------------------------
        // Seam 3: idempotent redelivery
        // -----------------------------------------------------------------------

        it('handler keyed on event_id is idempotent under redelivery', async () => {
            const seen = new Set<string>();
            let effectCount = 0;

            const idempotentHandler = async (event: DomainEvent<unknown>) => {
                if (seen.has(event.eventId)) return;
                seen.add(event.eventId);
                effectCount++;
            };

            const dispatcher = new PgPollingDispatcher(superPool, 'sample', idempotentHandler);

            // First delivery — row is pending from beforeEach.
            await dispatcher.poll();
            // Second poll — no pending rows; handler not called again.
            await dispatcher.poll();
            // Force a second delivery of the same row.
            await superPool.query(
                `UPDATE sample.outbox SET dispatched_at = NULL WHERE event_id = $1`,
                [DISPATCHER_EVENT_ID],
            );
            await dispatcher.poll();

            // The handler effect was applied exactly once despite two deliveries.
            expect(effectCount).toBe(1);
        });
    });
});
