// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import {
    PgOutboxWriter,
    OutboxWriteFailed,
    asClubId,
    asPrincipalId,
    asEventId,
    asEventType,
    asAggregateId,
    ClubEventScope,
    ExhibitorEventScope,
    PlatformEventScope,
} from '../../../../../src/Shared/index.js';
import type { DomainEvent } from '../../../../../src/Shared/domain/domain-event.js';

const CLUB_ID = asClubId('00000000-0000-4000-8000-0000000000aa');
const PRINCIPAL_ID = asPrincipalId('00000000-0000-4000-8000-0000000000bb');

const CLUB_EVENT: DomainEvent = {
    eventId: asEventId('00000000-0000-4000-8000-000000000001'),
    type: asEventType('entries.EntrySubmitted'),
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    scope: ClubEventScope.of(CLUB_ID),
    aggregateId: asAggregateId('entry-1'),
    payload: { x: 1 },
};

describe('PgOutboxWriter — E3 boundary wrapping', () => {
    it('wraps a raw pg failure as OutboxWriteFailed with the original on cause', async () => {
        const original = new Error('connection terminated');
        const failingClient = { query: () => Promise.reject(original) } as unknown as pg.PoolClient;

        const writer = new PgOutboxWriter('sample');

        let caught: unknown;
        try {
            await writer.write(failingClient, [CLUB_EVENT]);
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
                await new PgOutboxWriter('sample').write(failingClient, [CLUB_EVENT]);
            })(),
        ).rejects.not.toBe(original);
        // ...and it is an OutboxWriteFailed, not the bare Error.
        await expect(
            (async () => {
                await new PgOutboxWriter('sample').write(failingClient, [CLUB_EVENT]);
            })(),
        ).rejects.toBeInstanceOf(OutboxWriteFailed);
    });
});

describe('PgOutboxWriter — outbox row binding', () => {
    function capture(): { calls: { text: string; values: unknown[] }[]; client: pg.PoolClient } {
        const calls: { text: string; values: unknown[] }[] = [];
        const client = {
            query: (text: string, values: unknown[]) => {
                calls.push({ text, values });
                return Promise.resolve();
            },
        } as unknown as pg.PoolClient;
        return { calls, client };
    }

    it('binds event.scope.kind (not the scope object) to the scope column, and clubId from a club event', async () => {
        const { calls, client } = capture();

        await new PgOutboxWriter('sample').write(client, [CLUB_EVENT]);

        expect(calls).toHaveLength(1);
        const values = calls[0]?.values;
        // The `scope` column (4th bound param, index 3) receives the EventScope
        // `kind` string — the class instance is never written to the column.
        expect(values?.[3]).toBe('club');
        expect(values?.[4]).toBe(CLUB_ID);
        expect(values?.[5]).toBeNull();
    });

    it('derives club_id/user_id from the event scope, not any acting transaction scope (ADR-0027)', async () => {
        // The event was recorded under an exhibitor-acting transaction, but the
        // fact itself is Club-owned (a hybrid aggregate) — club_id must come
        // from event.scope regardless of who was acting.
        const hybridEvent: DomainEvent = { ...CLUB_EVENT, scope: ClubEventScope.of(CLUB_ID) };
        const { calls, client } = capture();

        await new PgOutboxWriter('sample').write(client, [hybridEvent]);

        const values = calls[0]?.values;
        expect(values?.[4]).toBe(CLUB_ID);
        expect(values?.[5]).toBeNull();
    });

    it('binds only principalId for an exhibitor-owned event', async () => {
        const exhibitorEvent: DomainEvent = {
            ...CLUB_EVENT,
            scope: ExhibitorEventScope.of(PRINCIPAL_ID),
        };
        const { calls, client } = capture();

        await new PgOutboxWriter('sample').write(client, [exhibitorEvent]);

        const values = calls[0]?.values;
        expect(values?.[3]).toBe('exhibitor');
        expect(values?.[4]).toBeNull();
        expect(values?.[5]).toBe(PRINCIPAL_ID);
    });

    it('binds neither owner column for a platform-owned event', async () => {
        const platformEvent: DomainEvent = { ...CLUB_EVENT, scope: PlatformEventScope.of() };
        const { calls, client } = capture();

        await new PgOutboxWriter('sample').write(client, [platformEvent]);

        const values = calls[0]?.values;
        expect(values?.[3]).toBe('platform');
        expect(values?.[4]).toBeNull();
        expect(values?.[5]).toBeNull();
    });
});
