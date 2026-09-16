// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PgOutboxWriter,
} from '../../../../../src/Shared/index.js';
import { SystemClock } from '../../../../../src/Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../../src/Shared/infrastructure/random-event-id-generator.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';
import { Show } from '../../../../../src/sample/domain/model/show/show.js';
import { asShowId } from '../../../../../src/sample/domain/shared/domain-ids.js';

// Fixed IDs for deterministic test data.
const CLUB_A_ID = '00000000-0000-4000-8000-000000000001';
const CLUB_B_ID = '00000000-0000-4000-8000-000000000002';
const ACCOUNT_A_ID = '00000000-0000-4000-8000-000000000011';
const ACCOUNT_B_ID = '00000000-0000-4000-8000-000000000012';
const SHOW_A_ID = '00000000-0000-4000-8000-000000000021';
const SHOW_B_ID = '00000000-0000-4000-8000-000000000022';
const ENTRY_HYBRID_ID = '00000000-0000-4000-8000-000000000031';

describe('RLS isolation — sample context', () => {
    const harness = new PostgresHarness();
    let appPool: pg.Pool;
    let unitOfWork: PgSampleUnitOfWork;

    beforeAll(async () => {
        await bootstrapSampleSchema(harness);

        appPool = harness.appUserPool;
        unitOfWork = new PgSampleUnitOfWork(
            appPool,
            new PgOutboxWriter('sample'),
            new SystemClock(),
            new RandomEventIdGenerator(),
        );

        // Seed test data as superuser (bypasses RLS entirely).
        await harness.seed(async (client) => {
            await client.query(
                `INSERT INTO sample.shows (id, club_id, name) VALUES
                   ($1, $2, 'Club A Show'),
                   ($3, $4, 'Club B Show')`,
                [SHOW_A_ID, CLUB_A_ID, SHOW_B_ID, CLUB_B_ID],
            );
            // Hybrid entry: owned by Club A, submitted by User A.
            await client.query(
                `INSERT INTO sample.entries (id, club_id, user_id, show_id, dog_name) VALUES
                   ($1, $2, $3, $4, 'Fido')`,
                [ENTRY_HYBRID_ID, CLUB_A_ID, ACCOUNT_A_ID, SHOW_A_ID],
            );
        });
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    describe('read-open, write-scoped table isolation (shows)', () => {
        // Shows must be discoverable by any exhibitor deciding whether to
        // enter one, so SELECT carries no ownership predicate (unlike the
        // plain `club` template) — every scope sees every Show.
        it('club-A scope sees every Show, not only Club A’s', async () => {
            await unitOfWork.run(
                ClubTransactionScope.of(asClubId(CLUB_A_ID), asPrincipalId(ACCOUNT_A_ID)),
                async (ctx) => {
                    const shows = await ctx.shows.findAll();
                    expect(shows.map((s) => s.name).sort()).toEqual(['Club A Show', 'Club B Show']);
                },
            );
        });

        it('an exhibitor scope (no clubId at all) also sees every Show', async () => {
            await unitOfWork.run(
                ExhibitorTransactionScope.of(asPrincipalId(ACCOUNT_A_ID)),
                async (ctx) => {
                    const shows = await ctx.shows.findAll();
                    expect(shows.map((s) => s.name).sort()).toEqual(['Club A Show', 'Club B Show']);
                },
            );
        });

        it('club-B scope cannot create a Show attributed to Club A', async () => {
            const forgedShow = Show.create(
                asShowId('00000000-0000-4000-8000-000000000099'),
                asClubId(CLUB_A_ID),
                'Forged Show',
            );

            await expect(
                unitOfWork.run(
                    ClubTransactionScope.of(asClubId(CLUB_B_ID), asPrincipalId(ACCOUNT_B_ID)),
                    async (ctx) => {
                        await ctx.shows.save(forgedShow);
                    },
                ),
            ).rejects.toThrow();
        });
    });

    describe('hybrid table isolation (entries)', () => {
        it('club-A scope sees the hybrid entry (matched by club_id)', async () => {
            await unitOfWork.run(
                ClubTransactionScope.of(asClubId(CLUB_A_ID), asPrincipalId(ACCOUNT_A_ID)),
                async (ctx) => {
                    const entries = await ctx.entries.findAll();
                    expect(entries).toHaveLength(1);
                    expect(entries[0]?.dogName).toBe('Fido');
                },
            );
        });

        it('exhibitor-A scope sees the hybrid entry (matched by user_id)', async () => {
            await unitOfWork.run(
                ExhibitorTransactionScope.of(asPrincipalId(ACCOUNT_A_ID)),
                async (ctx) => {
                    const entries = await ctx.entries.findAll();
                    expect(entries).toHaveLength(1);
                    expect(entries[0]?.dogName).toBe('Fido');
                },
            );
        });

        it('club-B scope cannot see the hybrid entry belonging to club-A', async () => {
            await unitOfWork.run(
                ClubTransactionScope.of(asClubId(CLUB_B_ID), asPrincipalId(ACCOUNT_B_ID)),
                async (ctx) => {
                    const entries = await ctx.entries.findAll();
                    expect(entries).toHaveLength(0);
                },
            );
        });
    });
});
