// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import type pg from 'pg';
import {
    PgOutboxWriter,
    OutboxWriteFailed,
    asClubId,
    asPrincipalId,
    asEventId,
    asEventType,
    asAggregateId,
    EventScope,
    ClubTransactionScope,
} from '../../../src/Shared/index.js';
import type { DomainEvent } from '../../../src/Shared/domain/domain-event.js';

const EVENT: DomainEvent<unknown> = {
    eventId: asEventId('00000000-0000-4000-8000-000000000001'),
    type: asEventType('entries.EntrySubmitted'),
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    scope: EventScope.club(),
    aggregateId: asAggregateId('entry-1'),
    payload: { x: 1 },
};

const CLUB_SCOPE = ClubTransactionScope.of(
    asClubId('00000000-0000-4000-8000-0000000000aa'),
    asPrincipalId('00000000-0000-4000-8000-0000000000bb'),
);

describe('PgOutboxWriter — E3 boundary wrapping', () => {
    it('wraps a raw pg failure as OutboxWriteFailed with the original on cause', async () => {
        const original = new Error('connection terminated');
        const failingClient = { query: () => Promise.reject(original) } as unknown as pg.PoolClient;

        const writer = new PgOutboxWriter('sample');

        let caught: unknown;
        try {
            await writer.write(failingClient, [EVENT], CLUB_SCOPE);
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(OutboxWriteFailed);
        const wrapped = caught as OutboxWriteFailed;
        // The original pg error's *message* is preserved on `cause` (a string, per
        // the E3 idiom — the foreign error object itself never crosses inward).
        expect(wrapped.cause).toBe(original.message);
        expect(wrapped.name).toBe('OutboxWriteFailed');
        expect(wrapped.message).toMatch(/Outbox write failed/);
    });

    it('does not let the raw pg error type escape unwrapped', async () => {
        const original = new Error('raw pg error');
        const failingClient = { query: () => Promise.reject(original) } as unknown as pg.PoolClient;

        await expect(
            (async () => {
                await new PgOutboxWriter('sample').write(failingClient, [EVENT], CLUB_SCOPE);
            })(),
        ).rejects.not.toBe(original);
        // ...and it is an OutboxWriteFailed, not the bare Error.
        await expect(
            (async () => {
                await new PgOutboxWriter('sample').write(failingClient, [EVENT], CLUB_SCOPE);
            })(),
        ).rejects.toBeInstanceOf(OutboxWriteFailed);
    });
});

describe('PgOutboxWriter — outbox row binding', () => {
    it('binds event.scope.kind (not the scope object) to the scope column, and the scope-derived ids', async () => {
        const calls: { text: string; values: unknown[] }[] = [];
        const capturingClient = {
            query: (text: string, values: unknown[]) => {
                calls.push({ text, values });
                return Promise.resolve();
            },
        } as unknown as pg.PoolClient;

        await new PgOutboxWriter('sample').write(capturingClient, [EVENT], CLUB_SCOPE);

        expect(calls).toHaveLength(1);
        const values = calls[0]?.values;
        // The `scope` column (4th bound param, index 3) receives the EventScope
        // `kind` string — the class instance is never written to the column.
        expect(values?.[3]).toBe('club');
        // The club_id / user_id columns come from the TransactionScope via scopeToRlsKeys.
        expect(values?.[4]).toBe(asClubId('00000000-0000-4000-8000-0000000000aa'));
        expect(values?.[5]).toBe(asPrincipalId('00000000-0000-4000-8000-0000000000bb'));
    });
});
