// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import {
    withOutboxTransaction,
    withTransaction,
    TransactionFailed,
    PgOutboxWriter,
    ClubTransactionScope,
    ClubEventScope,
    asClubId,
    asPrincipalId,
    asAggregateId,
    asEventId,
    asEventType,
    type Clock,
    type EventIdGenerator,
} from '../../../../../src/Shared/index.js';
import { runInClientTransaction } from '../../../../../src/Shared/infrastructure/persistence/postgres/with-transaction.js';

const SCOPE = ClubTransactionScope.of(
    asClubId('00000000-0000-4000-8000-000000000001'),
    asPrincipalId('00000000-0000-4000-8000-000000000011'),
);

function fakeClient(queryImpl: (text: string) => Promise<unknown>): pg.PoolClient {
    return { query: (text: string) => queryImpl(text) } as unknown as pg.PoolClient;
}

describe('runInClientTransaction — TransactionFailed wrapping', () => {
    it('wraps a BEGIN failure as TransactionFailed', async () => {
        const client = fakeClient((text) => {
            if (text === 'BEGIN') return Promise.reject(new Error('begin exploded'));
            return Promise.resolve();
        });

        await expect(runInClientTransaction(client, async () => 'ok')).rejects.toBeInstanceOf(
            TransactionFailed,
        );
    });

    it('wraps a COMMIT failure as TransactionFailed', async () => {
        const client = fakeClient((text) => {
            if (text === 'COMMIT') return Promise.reject(new Error('commit exploded'));
            return Promise.resolve();
        });

        await expect(runInClientTransaction(client, async () => 'ok')).rejects.toBeInstanceOf(
            TransactionFailed,
        );
    });

    it('does NOT wrap a body error — it propagates unwrapped and rolls back', async () => {
        const queries: string[] = [];
        const client = fakeClient((text) => {
            queries.push(text);
            return Promise.resolve();
        });
        const bodyError = new Error('business failure');

        await expect(
            runInClientTransaction(client, async () => {
                throw bodyError;
            }),
        ).rejects.toBe(bodyError);
        expect(queries).toContain('ROLLBACK');
    });

    it('a ROLLBACK failure after a body error does not mask the original error', async () => {
        const client = fakeClient((text) => {
            if (text === 'ROLLBACK') return Promise.reject(new Error('connection dead'));
            return Promise.resolve();
        });
        const bodyError = new Error('business failure');

        await expect(
            runInClientTransaction(client, async () => {
                throw bodyError;
            }),
        ).rejects.toBe(bodyError);
    });
});

describe('withTransaction — TransactionFailed wrapping', () => {
    it('wraps a pool.connect() failure as TransactionFailed', async () => {
        const pool = {
            connect: () => Promise.reject(new Error('pool exhausted')),
        } as unknown as pg.Pool;

        await expect(withTransaction(pool, SCOPE, async () => 'ok')).rejects.toBeInstanceOf(
            TransactionFailed,
        );
    });

    it('wraps a set_config (RLS session var) failure as TransactionFailed', async () => {
        const release = vi.fn();
        const client = {
            query: (text: string) => {
                if (text.includes('set_config'))
                    return Promise.reject(new Error('set_config failed'));
                return Promise.resolve();
            },
            release,
        } as unknown as pg.PoolClient;
        const pool = { connect: () => Promise.resolve(client) } as unknown as pg.Pool;

        await expect(withTransaction(pool, SCOPE, async () => 'ok')).rejects.toBeInstanceOf(
            TransactionFailed,
        );
        expect(release).toHaveBeenCalled();
    });
});

describe('withOutboxTransaction — stamping and writing recorded facts', () => {
    it('stamps eventId/occurredAt from the injected ports and writes via the writer', async () => {
        const fixedDate = new Date('2026-08-01T12:00:00.000Z');
        const clock: Clock = { now: () => fixedDate };
        let counter = 0;
        const eventIdGenerator: EventIdGenerator = {
            generate: () => asEventId(`00000000-0000-4000-8000-00000000000${++counter}`),
        };

        const writeCalls: { eventId: string; occurredAt: Date; type: string }[][] = [];
        const writer = {
            write: vi.fn(
                async (
                    _client: unknown,
                    events: readonly { eventId: string; occurredAt: Date; type: string }[],
                ) => {
                    writeCalls.push([...events]);
                },
            ),
        };

        const client = {
            query: () => Promise.resolve(),
            release: () => {},
        } as unknown as pg.PoolClient;
        const pool = { connect: () => Promise.resolve(client) } as unknown as pg.Pool;

        await withOutboxTransaction(
            pool,
            SCOPE,
            writer as unknown as PgOutboxWriter,
            clock,
            eventIdGenerator,
            async (_client, record) => {
                record({
                    type: asEventType('sample.EntrySubmitted'),
                    scope: ClubEventScope.of(SCOPE.clubId),
                    aggregateId: asAggregateId('entry-1'),
                    payload: { dogName: 'Fido' },
                });
            },
        );

        expect(writer.write).toHaveBeenCalledTimes(1);
        const written = writeCalls[0]?.[0];
        expect(written?.eventId).toBe('00000000-0000-4000-8000-000000000001');
        expect(written?.occurredAt).toBe(fixedDate);
        expect(written?.type).toBe('sample.EntrySubmitted');
    });

    it('does not call the writer when no facts were recorded', async () => {
        const writer = { write: vi.fn() };
        const client = {
            query: () => Promise.resolve(),
            release: () => {},
        } as unknown as pg.PoolClient;
        const pool = { connect: () => Promise.resolve(client) } as unknown as pg.Pool;

        await withOutboxTransaction(
            pool,
            SCOPE,
            writer as unknown as PgOutboxWriter,
            { now: () => new Date() },
            { generate: () => asEventId('00000000-0000-4000-8000-000000000001') },
            async () => {},
        );

        expect(writer.write).not.toHaveBeenCalled();
    });
});
