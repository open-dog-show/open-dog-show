// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { PgPollingDispatcher } from '../../../../src/Shared/infrastructure/messaging/pg-polling-dispatcher.js';
import { OutboxDispatchFailed } from '../../../../src/Shared/infrastructure/messaging/outbox-dispatch-failed.js';
import { DomainEventRehydrationRegistry } from '../../../../src/Shared/infrastructure/messaging/domain-event-rehydration-registry.js';
import type { DomainEventFact } from '../../../../src/Shared/domain/domain-event.js';
import { asEventType } from '../../../../src/Shared/domain/domain-event-type.js';

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

/**
 * Models the claim-time `SET attempts = attempts + 1 ... RETURNING
 * attempts` — runs before the handler, regardless of outcome. Guarded
 * behind `RETURNING attempts` so a production query that drops it (leaving
 * the claim step unable to read back the count) fails the test instead of
 * the fake silently supplying the missing behaviour itself.
 *
 * `vanish` models the row vanishing between `selectNextRow` and this UPDATE
 * — an outcome `PgPollingDispatcher.claimNextRow` treats as provably
 * impossible under Postgres's row-locking semantics and guards against with
 * a fail-fast throw. Real Postgres can never actually produce this (the row
 * is locked by this same transaction), so this is the only way to drive
 * that guard in a unit test.
 */
function claimAttempt(
    sql: string,
    seq: string,
    context: { readonly states: readonly RowState[]; readonly vanish: boolean },
) {
    if (!sql.includes('RETURNING attempts')) {
        throw new Error('fake expected `RETURNING attempts` in the claim UPDATE');
    }
    if (context.vanish) return { rows: [] };
    const state = findBySeq(context.states, seq);
    if (state) state.attempts += 1;
    return { rows: state ? [{ attempts: state.attempts }] : [] };
}

/**
 * Models the failure-recording `SET last_error` — runs only after the
 * handler fails; `attempts` was already bumped by {@link claimAttempt}.
 * Guarded behind the *absence* of `RETURNING`, so a production query that
 * conflates this with the claim UPDATE above fails the test.
 */
function recordLastError(sql: string, failRecording: boolean) {
    if (sql.includes('RETURNING')) {
        throw new Error('fake did not expect `RETURNING` in the last_error UPDATE');
    }
    if (failRecording) {
        throw new Error('recording query failed');
    }
    return { rows: [] };
}

function countQuarantined(states: readonly RowState[], maxAttempts: number) {
    const count = states.filter(
        (s) => s.dispatchedAt === undefined && s.attempts >= maxAttempts,
    ).length;
    return { rows: [{ count: String(count) }] };
}

/** Routes one fake query by matching the SQL fragments {@link fakePool}'s doc describes. Kept out of the `query` closure so its branch count doesn't count against the closure's own complexity budget. */
function routeFakeQuery(
    sql: string,
    params: readonly unknown[],
    context: {
        readonly states: readonly RowState[];
        readonly failRecording: boolean;
        readonly vanishDuringClaim: boolean;
    },
) {
    const { states, failRecording, vanishDuringClaim } = context;
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.startsWith('SELECT seq'))
        return selectNextRowValidated(sql, states, params[0] as number);
    if (sql.startsWith('SELECT COUNT')) return countQuarantined(states, params[0] as number);
    if (sql.includes('SET dispatched_at')) return markDispatched(states, params[0] as string);
    if (sql.includes('SET attempts'))
        return claimAttempt(sql, params[0] as string, { states, vanish: vanishDuringClaim });
    if (sql.includes('SET last_error')) return recordLastError(sql, failRecording);
    return { rows: [] };
}

/**
 * A `pg.Pool` fake that serves `states` through the dispatcher's real query
 * sequence, without a database:
 *
 * - `SELECT … FOR UPDATE SKIP LOCKED` honours `dispatched_at IS NULL AND
 *   attempts < $1` — a row already dispatched, or at `maxAttempts`, is
 *   skipped — and returns the lowest-`seq` eligible row, mirroring `ORDER BY
 *   seq LIMIT 1`.
 * - The claim transaction's `SET attempts = attempts + 1 ... RETURNING
 *   attempts` (matched by `RETURNING attempts`) always bumps the matching
 *   `RowState`, before the handler ever runs.
 * - `UPDATE … SET dispatched_at` mutates the matching `RowState` on success.
 * - The failure path's `SET last_error` (matched by `last_error` without
 *   `RETURNING`) does not touch `attempts` — it was already bumped at claim
 *   time.
 *
 * `options.failRecording` makes that `SET last_error` query itself reject,
 * simulating the best-effort `last_error` recording transaction failing.
 * `options.vanishDuringClaim` makes the claim UPDATE return no row, as if
 * the row vanished between `selectNextRow` and this UPDATE — see
 * {@link claimAttempt}.
 */
function fakePool(
    states: readonly RowState[],
    options?: { readonly failRecording?: boolean; readonly vanishDuringClaim?: boolean },
): pg.Pool {
    const client = {
        query: (text: string, params: readonly unknown[] = []) =>
            routeFakeQuery(text.trim(), params, {
                states,
                failRecording: options?.failRecording === true,
                vanishDuringClaim: options?.vanishDuringClaim === true,
            }),
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

    it('propagates the claim-vanish guard unwrapped, not as OutboxDispatchFailed, when the claim UPDATE returns no row (#210 grilling)', async () => {
        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([rowState()], { vanishDuringClaim: true }),
            schema: 'sample',
            handler: () => Promise.resolve(),
            registry: registryFor((fact) => fact),
        });

        let caught: unknown;
        try {
            await dispatcher.poll();
        } catch (err) {
            caught = err;
        }

        // A row vanishing here is not attributable to the handler — same
        // "not a per-row dispatch failure" category as a claim connection
        // fault, so it must not be wrapped as OutboxDispatchFailed either.
        expect(caught).not.toBeInstanceOf(OutboxDispatchFailed);
        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).message).toContain('vanished during claim');
    });

    it('preserves a failure in the best-effort last_error recording as cause.recordingError, rather than swallowing it', async () => {
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
        // `attempts` was already incremented at claim time, before the
        // handler ran — so it is known regardless of whether the later
        // `last_error` recording (this test's simulated failure) succeeds.
        // Both the original handler failure AND the recording failure are
        // preserved on `cause`, not discarded.
        expect(err.attempts).toBe(1);
        expect(err.cause).toMatchObject({
            error: 'handler blew up',
            recordingError: 'recording query failed',
        });
    });

    it('returns dispatched: 0, quarantined: 0 without throwing when there is no pending row', async () => {
        const dispatcher = new PgPollingDispatcher({
            pool: fakePool([]),
            schema: 'sample',
            handler: () => Promise.resolve(),
            registry: registryFor((fact) => fact),
        });

        await expect(dispatcher.poll()).resolves.toEqual({ dispatched: 0, quarantined: 0 });
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

        const result = await dispatcher.poll();

        expect(result).toEqual({ dispatched: 1, quarantined: 1 });
        // The quarantined row (attempts === maxAttempts) was never handed to
        // the handler — only the eligible row was.
        expect(handledAggregateIds).toEqual(['entry-2']);
        expect(quarantined.dispatchedAt).toBeUndefined();
        expect(eligible.dispatchedAt).toBeInstanceOf(Date);
        // `attempts` is bumped at claim time, before the handler ever runs —
        // a successful dispatch still leaves it at 1, not 0.
        expect(eligible.attempts).toBe(1);
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

    // This also covers the acceptance criterion "a handler that never settles
    // does not hold the row's transaction open indefinitely": `pollPromise`
    // already rejects, and `state.attempts`/`dispatchedAt` are already
    // asserted, *before* `resolveHandler` is ever called below — a variant
    // that never calls it at all would exercise the exact same code path (a
    // handler settling, or not, is invisible to the dispatcher once the
    // timeout has already won the race) and would only additionally prove
    // the test process itself doesn't hang, which vitest already guarantees
    // by timing out the test (#210 grilling).
    it('treats handlerTimeoutMs as a real dispatch failure even when the handler ignores its AbortSignal and resolves later (#210)', async () => {
        vi.useFakeTimers();
        try {
            const state = rowState();
            let resolveHandler: (() => void) | undefined;

            const dispatcher = new PgPollingDispatcher({
                pool: fakePool([state]),
                schema: 'sample',
                handlerTimeoutMs: HANDLER_TIMEOUT_MS,
                // Ignores the AbortSignal entirely — never rejects on abort,
                // only resolves once the test explicitly tells it to.
                handler: () =>
                    new Promise<void>((resolve) => {
                        resolveHandler = resolve;
                    }),
                registry: registryFor((fact) => fact),
            });

            const pollPromise = dispatcher.poll();
            const failed = expect(pollPromise).rejects.toBeInstanceOf(OutboxDispatchFailed);
            await vi.advanceTimersByTimeAsync(HANDLER_TIMEOUT_MS);
            await failed;

            // The handler only resolves now — well after the timeout already
            // failed the dispatch — proving a non-cooperating handler's late
            // success cannot turn a timed-out dispatch back into one.
            resolveHandler?.();

            expect(state.dispatchedAt).toBeUndefined();
            expect(state.dispatchCount).toBe(0);
            expect(state.attempts).toBe(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("lets a second dispatcher instance claim and run the same row while the first instance's handler is still in flight (widened redelivery window, #210)", async () => {
        vi.useFakeTimers();
        try {
            const state = rowState();
            const states = [state];
            let releaseFirstHandler: (() => void) | undefined;
            const firstHandlerCalls: string[] = [];
            const secondHandlerCalls: string[] = [];

            const first = new PgPollingDispatcher({
                pool: fakePool(states),
                schema: 'sample',
                handlerTimeoutMs: 0,
                handler: (event) => {
                    firstHandlerCalls.push(String(event.aggregateId));
                    // Held open — never resolves on its own — so the second
                    // instance's poll runs while this handler is still in
                    // flight.
                    return new Promise<void>((resolve) => {
                        releaseFirstHandler = resolve;
                    });
                },
                registry: registryFor((fact) => fact),
            });
            const second = new PgPollingDispatcher({
                pool: fakePool(states),
                schema: 'sample',
                handlerTimeoutMs: 0,
                handler: (event) => {
                    secondHandlerCalls.push(String(event.aggregateId));
                    return Promise.resolve();
                },
                registry: registryFor((fact) => fact),
            });

            const firstPollPromise = first.poll();
            // No real timer is armed (handlerTimeoutMs: 0) — this just
            // flushes the microtask chain (claim transaction, then the
            // handler call) up to the point where the handler's promise is
            // pending.
            await vi.advanceTimersByTimeAsync(0);
            expect(firstHandlerCalls).toEqual(['entry-1']);
            // The claim transaction already committed and released the row's
            // lock; dispatched_at is still NULL — exactly the window the
            // class doc now describes.
            expect(state.attempts).toBe(1);
            expect(state.dispatchedAt).toBeUndefined();

            const secondResult = await second.poll();

            expect(secondResult).toEqual({ dispatched: 1, quarantined: 0 });
            expect(secondHandlerCalls).toEqual(['entry-1']);
            expect(state.dispatchedAt).toBeInstanceOf(Date);
            expect(state.attempts).toBe(2);

            // The first instance's handler is still pending throughout the
            // above — only now let it resolve, proving its own poll()
            // completes independently of the second instance's.
            releaseFirstHandler?.();
            await firstPollPromise;
            expect(state.dispatchCount).toBe(2);
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

        const result = await dispatcher.poll(10);

        expect(result).toEqual({ dispatched: 3, quarantined: 0 });
        expect(handledAggregateIds).toEqual(['entry-1', 'entry-2', 'entry-3']);
        for (const state of rows) {
            expect(state.dispatchedAt).toBeInstanceOf(Date);
            expect(state.dispatchCount).toBe(1);
            // Claimed once each, before their handlers ran.
            expect(state.attempts).toBe(1);
        }
    });
});
