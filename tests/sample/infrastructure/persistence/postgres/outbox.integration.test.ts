// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import {
    asAggregateId,
    asClubId,
    asPrincipalId,
    asEventId,
    EventScope,
    ClubTransactionScope,
    FakeClock,
    FakeEventIdGenerator,
    PgOutboxWriter,
    PgPollingDispatcher,
    type DomainEvent,
} from '../../../../../src/Shared/index.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';
import { asEntryId, asShowId } from '../../../../../src/sample/domain/shared/domain-ids.js';
import { Entry } from '../../../../../src/sample/domain/model/entry/entry.js';
import { EntrySubmitted } from '../../../../../src/sample/domain/model/entry/events/entry-submitted.js';
import { buildSampleEventRehydrationRegistry } from '../../../../../src/sample/infrastructure/di/sample-event-registry.js';

// Fixed deterministic IDs.
const CLUB_ID = '00000000-0000-4000-8000-000000000001';
const PRINCIPAL_ID = '00000000-0000-4000-8000-000000000011';
const SHOW_ID = '00000000-0000-4000-8000-000000000021';
const ENTRY_ID = '00000000-0000-4000-8000-000000000031';
const EVENT_ID = '00000000-0000-4000-8000-000000000041';

const scope = ClubTransactionScope.of(asClubId(CLUB_ID), asPrincipalId(PRINCIPAL_ID));
const entry = Entry.submit(scope, {
    id: asEntryId(ENTRY_ID),
    showId: asShowId(SHOW_ID),
    dogName: 'Fido',
});

describe('Transactional outbox — sample context', () => {
    const harness = new PostgresHarness();
    let superPool: pg.Pool;
    let appPool: pg.Pool;
    let unitOfWork: PgSampleUnitOfWork;

    beforeAll(async () => {
        await bootstrapSampleSchema(harness);

        superPool = harness.superPool;
        appPool = harness.appUserPool;
        unitOfWork = new PgSampleUnitOfWork(appPool, new PgOutboxWriter('sample'));

        // Seed a show (foreign-key target for entries) as superuser (bypasses RLS).
        await harness.seed(async (client) => {
            await client.query(`INSERT INTO sample.shows (id, club_id, name) VALUES ($1, $2, $3)`, [
                SHOW_ID,
                CLUB_ID,
                'Outbox Test Show',
            ]);
        });
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    function makeEvent(): EntrySubmitted {
        return EntrySubmitted.from(
            {
                scope: EventScope.club(),
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

    // -------------------------------------------------------------------------
    // Seam 1: same-transaction write
    // -------------------------------------------------------------------------

    describe('same-transaction write', () => {
        // Each test in this block writes to fixed ENTRY_ID/EVENT_ID rows, so
        // start from a clean slate to keep them independent of ordering and of
        // each other (the rollback test asserts the rows are absent).
        beforeEach(async () => {
            await superPool.query(`DELETE FROM sample.entries`);
            await superPool.query(`DELETE FROM sample.outbox`);
        });

        it('rolls back both the entry and the outbox row when the transaction fails', async () => {
            await expect(
                unitOfWork.run(scope, async (ctx) => {
                    await ctx.entries.save(entry);
                    ctx.appendEvents(makeEvent());
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
            await unitOfWork.run(scope, async (ctx) => {
                await ctx.entries.save(entry);
                ctx.appendEvents(makeEvent());
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

        it('writes only one outbox row when the same event (same eventId) is appended twice (ON CONFLICT DO NOTHING)', async () => {
            await superPool.query(`DELETE FROM sample.outbox WHERE event_id = $1`, [EVENT_ID]);

            const event = makeEvent();

            // Append the same DomainEvent object twice in one unit of work.
            // The outbox writer's `ON CONFLICT (event_id) DO NOTHING` guard must
            // collapse the second insert, leaving exactly one row — the
            // idempotency guarantee the kernel advertises for event replay.
            await unitOfWork.run(scope, async (ctx) => {
                ctx.appendEvents(event, event);
            });

            const { rows } = await superPool.query(
                `SELECT event_id FROM sample.outbox WHERE event_id = $1`,
                [EVENT_ID],
            );
            expect(rows).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // Seam 2: dispatcher round-trip
    // -------------------------------------------------------------------------

    // A distinct event ID for dispatcher tests so they are fully self-contained
    // and do not share state with the same-transaction write tests above.
    const DISPATCHER_EVENT_ID = '00000000-0000-4000-8000-000000000042';
    // Distinct event IDs for the handler-failure test: the first row's handler
    // throws, the second must be left pending (the batch aborts on first failure).
    const FAILING_EVENT_ID = '00000000-0000-4000-8000-000000000051';
    const LATER_EVENT_ID = '00000000-0000-4000-8000-000000000052';

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

        it('rehydrates a sample.EntrySubmitted row into an EntrySubmitted class instance via the registry', async () => {
            // The dispatcher is constructed with the sample context's
            // event-type → class rehydration registry, so a stored
            // `sample.EntrySubmitted` row is rehydrated into an `EntrySubmitted`
            // class instance (not the generic DomainEvent envelope) and the
            // handler can discriminate by `instanceof` (issue #172).
            const registry = buildSampleEventRehydrationRegistry();
            let received: DomainEvent<unknown> | undefined;
            const dispatcher = new PgPollingDispatcher(
                superPool,
                'sample',
                async (event) => {
                    received = event;
                },
                { registry },
            );

            const count = await dispatcher.poll();

            expect(count).toBe(1);
            expect(received).toBeInstanceOf(EntrySubmitted);
            expect(received?.type).toBe('sample.EntrySubmitted');
            expect(received?.aggregateId).toBe(asAggregateId(ENTRY_ID));
            expect(received?.payload).toStrictEqual({ dogName: 'Fido' });
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

        it('rethrows on a handler error and leaves later rows pending (batch aborts on first failure)', async () => {
            await superPool.query(`DELETE FROM sample.outbox`);
            await superPool.query(
                `INSERT INTO sample.outbox
                   (event_id, type, occurred_at, scope, aggregate_id, payload)
                 VALUES
                   ($1, $2, $3, $4, $5, $6),
                   ($7, $2, $3, $4, $5, $6)`,
                [
                    FAILING_EVENT_ID,
                    'sample.EntrySubmitted',
                    '2026-08-01T12:00:00.000Z',
                    'club',
                    ENTRY_ID,
                    JSON.stringify({ dogName: 'Fido' }),
                    LATER_EVENT_ID,
                ],
            );

            const dispatcher = new PgPollingDispatcher(superPool, 'sample', async (event) => {
                if (event.eventId === asEventId(FAILING_EVENT_ID)) {
                    throw new Error('handler failure');
                }
            });

            await expect(dispatcher.poll(10)).rejects.toThrow('handler failure');

            // The failing row's transaction rolled back and the batch aborted
            // on the first failure — both rows remain pending (dispatched_at NULL).
            const { rows } = await superPool.query(
                `SELECT dispatched_at FROM sample.outbox ORDER BY seq`,
            );
            expect(rows).toHaveLength(2);
            expect(rows.every((r) => r.dispatched_at === null)).toBe(true);
        });

        // -----------------------------------------------------------------------
        // Seam 4: poison-pill retry cap & handler timeout
        // -----------------------------------------------------------------------

        it('records attempts and last_error on a handler failure', async () => {
            const dispatcher = new PgPollingDispatcher(
                superPool,
                'sample',
                async () => {
                    throw new Error('handler failure');
                },
                { maxAttempts: 3 },
            );

            await expect(dispatcher.poll()).rejects.toThrow('handler failure');

            const { rows } = await superPool.query<{ attempts: number; last_error: string | null }>(
                `SELECT attempts, last_error FROM sample.outbox WHERE event_id = $1`,
                [DISPATCHER_EVENT_ID],
            );
            expect(rows[0]?.attempts).toBe(1);
            expect(rows[0]?.last_error).toContain('handler failure');
        });

        it('quarantines a row after maxAttempts and dispatches a later row in the same poll', async () => {
            await superPool.query(`DELETE FROM sample.outbox`);
            // Two rows: the poison (lower seq) and a later healthy row.
            await superPool.query(
                `INSERT INTO sample.outbox
                   (event_id, type, occurred_at, scope, aggregate_id, payload)
                 VALUES
                   ($1, $2, $3, $4, $5, $6),
                   ($7, $2, $3, $4, $5, $6)`,
                [
                    FAILING_EVENT_ID,
                    'sample.EntrySubmitted',
                    '2026-08-01T12:00:00.000Z',
                    'club',
                    ENTRY_ID,
                    JSON.stringify({ dogName: 'Fido' }),
                    LATER_EVENT_ID,
                ],
            );

            const poisonDispatcher = new PgPollingDispatcher(
                superPool,
                'sample',
                async () => {
                    throw new Error('poison');
                },
                { maxAttempts: 2 },
            );
            // Drive the poison row to the attempt cap: each poll fails fast on the
            // lowest-seq row and rethrows, so the later row is never touched.
            for (let i = 0; i < 2; i++) {
                await expect(poisonDispatcher.poll()).rejects.toThrow('poison');
            }

            // A healthy dispatcher now polls: the quarantined poison is skipped
            // (attempts >= maxAttempts) and the later row is dispatched instead.
            const okDispatcher = new PgPollingDispatcher(superPool, 'sample', async () => {}, {
                maxAttempts: 2,
            });
            const count = await okDispatcher.poll(10);
            expect(count).toBe(1);

            const { rows } = await superPool.query<{
                event_id: string;
                dispatched_at: Date | null;
                attempts: number;
            }>(`SELECT event_id, dispatched_at, attempts FROM sample.outbox ORDER BY seq`);
            const poison = rows.find((r) => r.event_id === FAILING_EVENT_ID);
            const later = rows.find((r) => r.event_id === LATER_EVENT_ID);
            expect(poison?.dispatched_at).toBeNull();
            expect(poison?.attempts).toBe(2);
            expect(later?.dispatched_at).not.toBeNull();
        });

        it('treats a handler that blocks until abort as a timeout failure', async () => {
            const dispatcher = new PgPollingDispatcher(
                superPool,
                'sample',
                async (_event, signal) => {
                    // Blocks indefinitely on its own; rejects when the signal aborts.
                    await new Promise<void>((_, reject) => {
                        signal.addEventListener('abort', () =>
                            reject(new Error('handler aborted')),
                        );
                    });
                },
                { handlerTimeoutMs: 50 },
            );

            await expect(dispatcher.poll()).rejects.toThrow('handler aborted');

            const { rows } = await superPool.query<{
                attempts: number;
                last_error: string | null;
                dispatched_at: Date | null;
            }>(
                `SELECT attempts, last_error, dispatched_at FROM sample.outbox WHERE event_id = $1`,
                [DISPATCHER_EVENT_ID],
            );
            expect(rows[0]?.attempts).toBe(1);
            expect(rows[0]?.last_error).toContain('handler aborted');
            expect(rows[0]?.dispatched_at).toBeNull();
        });
    });
});
