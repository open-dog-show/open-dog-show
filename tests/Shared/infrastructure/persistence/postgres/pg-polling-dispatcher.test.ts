// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { PgPollingDispatcher } from '../../../../../src/Shared/infrastructure/persistence/postgres/pg-polling-dispatcher.js';
import { OutboxDispatchFailed } from '../../../../../src/Shared/infrastructure/persistence/postgres/outbox-dispatch-failed.js';
import { DomainEventRehydrationRegistry } from '../../../../../src/Shared/infrastructure/messaging/domain-event-codec.js';
import type { DomainEventFact } from '../../../../../src/Shared/domain/domain-event.js';
import { asEventType } from '../../../../../src/Shared/domain/domain-event-type.js';

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

const PENDING_ROW: OutboxRowRaw = {
    seq: '1',
    event_id: '00000000-0000-4000-8000-000000000001',
    type: 'sample.EntrySubmitted',
    occurred_at: new Date('2026-08-01T12:00:00.000Z'),
    scope: 'platform',
    club_id: null,
    user_id: null,
    aggregate_id: 'entry-1',
    payload: {},
};

/**
 * A minimal `pg.Pool` fake that serves `row` exactly once via the
 * dispatcher's `SELECT … FOR UPDATE SKIP LOCKED` query, then reports no
 * pending rows. `SET attempts` returns `attempts: 1`, mirroring a first
 * failure — unless `options.failRecording` is set, in which case the `SET
 * attempts` query itself rejects, simulating the best-effort recording
 * transaction failing. Sufficient to drive `processOne` through its real
 * query sequence without a database.
 */
function fakePool(
    row: OutboxRowRaw | undefined,
    options?: { readonly failRecording?: boolean },
): pg.Pool {
    let served = false;
    const client = {
        query: async (text: string) => {
            const sql = text.trim();
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
            if (sql.startsWith('SELECT seq')) {
                if (served || row === undefined) return { rows: [] };
                served = true;
                return { rows: [row] };
            }
            if (sql.includes('SET attempts')) {
                if (options?.failRecording === true) {
                    throw new Error('recording query failed');
                }
                return { rows: [{ attempts: 1 }] };
            }
            return { rows: [] };
        },
        release: () => {},
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
                new PgPollingDispatcher(
                    fakePool,
                    'sample',
                    async () => {},
                    // @ts-expect-error — registry is required; this pins the runtime guard for a caller that bypasses tsc.
                    undefined,
                ),
        ).toThrow(TypeError);
    });

    it('accepts a registry and does not throw at construction', () => {
        const fakePool = {} as unknown as pg.Pool;

        expect(
            () =>
                new PgPollingDispatcher(
                    fakePool,
                    'sample',
                    async () => {},
                    new DomainEventRehydrationRegistry(),
                ),
        ).not.toThrow();
    });
});

describe('PgPollingDispatcher — OutboxDispatchFailed', () => {
    it('wraps a handler failure, carrying seq/eventId/type/attempts', async () => {
        const dispatcher = new PgPollingDispatcher(
            fakePool(PENDING_ROW),
            'sample',
            async () => {
                throw new Error('handler blew up');
            },
            registryFor((fact) => fact),
        );

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
        const dispatcher = new PgPollingDispatcher(
            fakePool(PENDING_ROW),
            'sample',
            async () => {},
            new DomainEventRehydrationRegistry(), // empty — nothing registered
        );

        await expect(dispatcher.poll()).rejects.toBeInstanceOf(OutboxDispatchFailed);
    });

    it('does not wrap a failure that happens before any row is selected', async () => {
        const brokenPool = {
            connect: () => Promise.reject(new Error('pool exhausted')),
        } as unknown as pg.Pool;
        const dispatcher = new PgPollingDispatcher(
            brokenPool,
            'sample',
            async () => {},
            registryFor((fact) => fact),
        );

        await expect(dispatcher.poll()).rejects.not.toBeInstanceOf(OutboxDispatchFailed);
    });

    it('preserves a failure in the best-effort attempts/last_error recording as cause.recordingError, rather than swallowing it', async () => {
        const dispatcher = new PgPollingDispatcher(
            fakePool(PENDING_ROW, { failRecording: true }),
            'sample',
            async () => {
                throw new Error('handler blew up');
            },
            registryFor((fact) => fact),
        );

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
        const dispatcher = new PgPollingDispatcher(
            fakePool(undefined),
            'sample',
            async () => {},
            registryFor((fact) => fact),
        );

        await expect(dispatcher.poll()).resolves.toBe(0);
    });
});
