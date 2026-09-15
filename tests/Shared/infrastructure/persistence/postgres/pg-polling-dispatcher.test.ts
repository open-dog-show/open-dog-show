// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { PgPollingDispatcher } from '../../../../../src/Shared/infrastructure/persistence/postgres/pg-polling-dispatcher.js';
import { OutboxDispatchFailed } from '../../../../../src/Shared/infrastructure/persistence/postgres/outbox-dispatch-failed.js';
import { DomainEventRehydrationRegistry } from '../../../../../src/Shared/infrastructure/messaging/domain-event-codec.js';
import type { DomainEventFact } from '../../../../../src/Shared/domain/domain-event.js';
import { asEventType } from '../../../../../src/Shared/domain/domain-event-type.js';

/** Quarantine threshold shared by the dispatcher's `maxAttempts` and a seeded poison-pill row's `attempts`, so the two stay in lockstep. */
const MAX_ATTEMPTS = 5;
/** Handler timeout shared by the dispatcher's `handlerTimeoutMs` and the fake-timer advance that fires it, so the two stay in lockstep. */
const HANDLER_TIMEOUT_MS = 50;

interface OutboxRowRaw {
    seq: string;
    event_id: string;
    type: string;
    occurred_at: Date;
    scope: string;
    club_id: string | null;
    user_id: string | null;
    aggregate_id: string;
    payload: unknown;
}

function outboxRow(overrides: Partial<OutboxRowRaw> = {}): OutboxRowRaw {
    return {
        seq: '1',
        event_id: '00000000-0000-4000-8000-000000000001',
        type: 'sample.EntrySubmitted',
        occurred_at: new Date('2026-08-01T12:00:00.000Z'),
        scope: 'platform',
        club_id: null,
        user_id: null,
        aggregate_id: 'entry-1',
        payload: {},
        ...overrides,
    };
}

const PENDING_ROW: OutboxRowRaw = outboxRow();

/**
 * Mutable per-row state a `fakePool` tracks across the dispatcher's real
 * query sequence, so a test can both drive the fake (an initial `attempts`
 * for a poison-pill scenario) and assert on it afterward (was this row ever
 * marked dispatched; how many attempts did it accumulate).
 */
interface RowState {
    readonly row: OutboxRowRaw;
    attempts: number;
    dispatchedAt: Date | undefined;
    /** How many times `SET dispatched_at` was applied to this row — a duplicate dispatch overwrites the same `dispatchedAt` Date, so this is what actually catches it. */
    dispatchCount: number;
}

function rowState(overrides: Partial<OutboxRowRaw> = {}, attempts = 0): RowState {
    return { row: outboxRow(overrides), attempts, dispatchedAt: undefined, dispatchCount: 0 };
}

function selectNextRow(states: readonly RowState[], maxAttempts: number) {
    const [next] = states
        .filter((s) => s.dispatchedAt === undefined && s.attempts < maxAttempts)
        .sort((a, b) => Number(a.row.seq) - Number(b.row.seq));
    return { rows: next ? [next.row] : [] };
}

/**
 * Guards `selectNextRow` behind the SQL clauses it models, so a production
 * query that drops the quarantine predicate or the ordering fails the test
 * instead of the fake silently supplying the missing behaviour itself.
 */
function selectNextRowValidated(sql: string, states: readonly RowState[], maxAttempts: number) {
    if (!sql.includes('attempts < $1')) {
        throw new Error(
            'fake expected the quarantine predicate `attempts < $1` in the SELECT query',
        );
    }
    if (!sql.includes('ORDER BY seq')) {
        throw new Error('fake expected `ORDER BY seq` in the SELECT query');
    }
    return selectNextRow(states, maxAttempts);
}

function findBySeq(states: readonly RowState[], seq: string): RowState | undefined {
    return states.find((s) => s.row.seq === seq);
}

function markDispatched(states: readonly RowState[], seq: string) {
    const state = findBySeq(states, seq);
    if (state) {
        state.dispatchedAt = new Date();
        state.dispatchCount += 1;
    }
    return { rows: [] };
}

function recordAttempt(states: readonly RowState[], seq: string, failRecording: boolean) {
    if (failRecording) {
        throw new Error('recording query failed');
    }
    const state = findBySeq(states, seq);
    if (state) state.attempts += 1;
    return { rows: [{ attempts: state?.attempts ?? 0 }] };
}

/**
 * A `pg.Pool` fake that serves `states` through the dispatcher's real query
 * sequence, without a database:
 *
 * - `SELECT … FOR UPDATE SKIP LOCKED` honours `dispatched_at IS NULL AND
 *   attempts < $1` — a row already dispatched, or at `maxAttempts`, is
 *   skipped — and returns the lowest-`seq` eligible row, mirroring `ORDER BY
 *   seq LIMIT 1`.
 * - `UPDATE … SET dispatched_at` and `SET attempts` mutate the matching
 *   `RowState` in place so a test can assert on it after `poll()` settles.
 *
 * `options.failRecording` makes the `SET attempts` query itself reject,
 * simulating the best-effort attempts/`last_error` recording transaction
 * failing.
 */
function fakePool(
    states: readonly RowState[],
    options?: { readonly failRecording?: boolean },
): pg.Pool {
    const client = {
        query: (text: string, params: readonly unknown[] = []) => {
            const sql = text.trim();
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
            if (sql.startsWith('SELECT seq')) {
                return selectNextRowValidated(sql, states, params[0] as number);
            }
            if (sql.includes('SET dispatched_at'))
                return markDispatched(states, params[0] as string);
            if (sql.includes('SET attempts')) {
                return recordAttempt(states, params[0] as string, options?.failRecording === true);
            }
            return { rows: [] };
        },
        release: () => undefined,
    };
    return { connect: () => Promise.resolve(client) } as unknown as pg.Pool;
}

function registryFor(rehydrate: (fact: DomainEventFact) => DomainEventFact) {
    const registry = new DomainEventRehydrationRegistry();
    registry.register(asEventType('sample.EntrySubmitted'), rehydrate);
    return registry;
}

describe('PgPollingDispatcher construction', () => {
    it('throws a clear TypeError when constructed without a registry (registry is required, ADR-0022/#176)', () => {
        const fakePool = {} as unknown as pg.Pool;

        expect(
            () =>
                new PgPollingDispatcher({
                    pool: fakePool,
                    schema: 'sample',
                    handler: () => Promise.resolve(),
                    // @ts-expect-error — registry is required; this pins the runtime guard for a caller that bypasses tsc.
                    registry: undefined,
                }),
        ).toThrow(TypeError);
    });

    it('accepts a registry and does not throw at construction', () => {
        const fakePool = {} as unknown as pg.Pool;

        expect(
            () =>
                new PgPollingDispatcher({
                    pool: fakePool,
                    schema: 'sample',
                    handler: () => Promise.resolve(),
                    registry: new DomainEventRehydrationRegistry(),
                }),
        ).not.toThrow();
    });
});

describe('PgPollingDispatcher — OutboxDispatchFailed', () => {
    it('wraps a handler failure, carrying seq/eventId/type/attempts', async () => {
        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([rowState()]),
            schema: 'sample',
            handler: () => {
                throw new Error('handler blew up');
            },
            registry: registryFor((fact) => fact),
        });

        let caught: unknown;
        try {
            await dispatcher.poll();
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(OutboxDispatchFailed);
        const err = caught as OutboxDispatchFailed;
        expect(err.seq).toBe(PENDING_ROW.seq);
        expect(err.eventId).toBe(PENDING_ROW.event_id);
        expect(err.type).toBe(PENDING_ROW.type);
        expect(err.attempts).toBe(1);
        expect(err.cause).toMatchObject({ error: 'handler blew up' });
    });

    it('wraps an unregistered-type failure the same way as a handler failure', async () => {
        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([rowState()]),
            schema: 'sample',
            handler: () => Promise.resolve(),
            registry: new DomainEventRehydrationRegistry(), // empty — nothing registered
        });

        await expect(dispatcher.poll()).rejects.toBeInstanceOf(OutboxDispatchFailed);
    });

    it('does not wrap a failure that happens before any row is selected', async () => {
        const brokenPool = {
            connect: () => Promise.reject(new Error('pool exhausted')),
        } as unknown as pg.Pool;
        const dispatcher = new PgPollingDispatcher({
            pool: brokenPool,
            schema: 'sample',
            handler: () => Promise.resolve(),
            registry: registryFor((fact) => fact),
        });

        await expect(dispatcher.poll()).rejects.not.toBeInstanceOf(OutboxDispatchFailed);
    });

    it('preserves a failure in the best-effort attempts/last_error recording as cause.recordingError, rather than swallowing it', async () => {
        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([rowState()], { failRecording: true }),
            schema: 'sample',
            handler: () => {
                throw new Error('handler blew up');
            },
            registry: registryFor((fact) => fact),
        });

        let caught: unknown;
        try {
            await dispatcher.poll();
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(OutboxDispatchFailed);
        const err = caught as OutboxDispatchFailed;
        // The recording query itself failed, so `attempts` could not be read
        // back and defaults to 0 — but the original handler failure AND the
        // recording failure are both preserved on `cause`, not discarded.
        expect(err.attempts).toBe(0);
        expect(err.cause).toMatchObject({
            error: 'handler blew up',
            recordingError: 'recording query failed',
        });
    });

    it('returns 0 without throwing when there is no pending row', async () => {
        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([]),
            schema: 'sample',
            handler: () => Promise.resolve(),
            registry: registryFor((fact) => fact),
        });

        await expect(dispatcher.poll()).resolves.toBe(0);
    });
});

describe('PgPollingDispatcher — poison-pill quarantine, handler timeout, multi-row dispatch (#205)', () => {
    it('skips a row already at maxAttempts while dispatching an eligible row', async () => {
        const quarantined = rowState(
            { seq: '1', event_id: '00000000-0000-4000-8000-000000000001', aggregate_id: 'entry-1' },
            MAX_ATTEMPTS,
        );
        const eligible = rowState(
            { seq: '2', event_id: '00000000-0000-4000-8000-000000000002', aggregate_id: 'entry-2' },
            0,
        );
        const handledAggregateIds: string[] = [];

        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([quarantined, eligible]),
            schema: 'sample',
            maxAttempts: MAX_ATTEMPTS,
            handler: (event) => {
                handledAggregateIds.push(String(event.aggregateId));
                return Promise.resolve();
            },
            registry: registryFor((fact) => fact),
        });

        const dispatchedCount = await dispatcher.poll();

        expect(dispatchedCount).toBe(1);
        // The quarantined row (attempts === maxAttempts) was never handed to
        // the handler — only the eligible row was.
        expect(handledAggregateIds).toEqual(['entry-2']);
        expect(quarantined.dispatchedAt).toBeUndefined();
        expect(eligible.dispatchedAt).toBeInstanceOf(Date);
    });

    it('aborts the handler via its AbortSignal on handlerTimeoutMs, and does not mark the row dispatched', async () => {
        vi.useFakeTimers();
        try {
            const state = rowState();
            let receivedSignal: AbortSignal | undefined;

            const dispatcher = new PgPollingDispatcher({
                pool: fakePool([state]),
                schema: 'sample',
                handlerTimeoutMs: HANDLER_TIMEOUT_MS,
                handler: (_event, signal) => {
                    receivedSignal = signal;
                    // Never resolves on its own — only settles (by rejecting)
                    // once the dispatcher aborts it on timeout.
                    return new Promise((_resolve, reject) => {
                        signal.addEventListener('abort', () => {
                            reject(new Error('handler aborted'));
                        });
                    });
                },
                registry: registryFor((fact) => fact),
            });

            const pollPromise = dispatcher.poll();
            // Attach the rejection assertion before advancing timers — the
            // handler's promise rejects synchronously once the timer fires,
            // so waiting to attach `.rejects` afterward would leave a window
            // where Node reports it as an unhandled rejection.
            const failed = expect(pollPromise).rejects.toBeInstanceOf(OutboxDispatchFailed);
            await vi.advanceTimersByTimeAsync(HANDLER_TIMEOUT_MS);
            await failed;
            expect(receivedSignal?.aborted).toBe(true);
            // Row stays pending for retry, not marked dispatched.
            expect(state.dispatchedAt).toBeUndefined();
            expect(state.attempts).toBe(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('dispatches every row of a multi-row poll, marking each dispatched exactly once', async () => {
        const rows = [
            rowState({
                seq: '1',
                event_id: '00000000-0000-4000-8000-000000000001',
                aggregate_id: 'entry-1',
            }),
            rowState({
                seq: '2',
                event_id: '00000000-0000-4000-8000-000000000002',
                aggregate_id: 'entry-2',
            }),
            rowState({
                seq: '3',
                event_id: '00000000-0000-4000-8000-000000000003',
                aggregate_id: 'entry-3',
            }),
        ];
        const handledAggregateIds: string[] = [];

        const dispatcher = new PgPollingDispatcher({
            pool: fakePool(rows),
            schema: 'sample',
            handler: (event) => {
                handledAggregateIds.push(String(event.aggregateId));
                return Promise.resolve();
            },
            registry: registryFor((fact) => fact),
        });

        const dispatchedCount = await dispatcher.poll(10);

        expect(dispatchedCount).toBe(3);
        expect(handledAggregateIds).toEqual(['entry-1', 'entry-2', 'entry-3']);
        for (const state of rows) {
            expect(state.dispatchedAt).toBeInstanceOf(Date);
            expect(state.dispatchCount).toBe(1);
        }
    });
});
