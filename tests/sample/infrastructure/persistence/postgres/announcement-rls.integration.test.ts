// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import {
    asClubId,
    asPrincipalId,
    ClubTransactionScope,
    ExhibitorTransactionScope,
    PgOutboxWriter,
    PlatformTransactionScope,
} from '../../../../../src/Shared/index.js';
import { SystemClock } from '../../../../../src/Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../../src/Shared/infrastructure/random-event-id-generator.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';
import { Announcement } from '../../../../../src/sample/domain/model/announcement/announcement.js';
import { asAnnouncementId } from '../../../../../src/sample/domain/shared/domain-ids.js';
import { ConcurrentModificationError } from '../../../../../src/sample/domain/shared/concurrent-modification-error.js';

const ANNOUNCEMENT_ID = asAnnouncementId('00000000-0000-4000-8000-000000000021');
const CONCURRENCY_ANNOUNCEMENT_ID = asAnnouncementId('00000000-0000-4000-8000-000000000022');

/**
 * Proves the ADR-0005 `platform` template: no RLS predicate at all — a row
 * created under a `platform` scope is equally visible under an unrelated
 * Club scope and an unrelated exhibitor scope.
 */
describe('Announcement (platform scope) — RLS-exempt', () => {
    const harness = new PostgresHarness();
    let unitOfWork: PgSampleUnitOfWork;

    beforeAll(async () => {
        await bootstrapSampleSchema(harness);
        unitOfWork = new PgSampleUnitOfWork({
            pool: harness.appUserPool,
            writer: new PgOutboxWriter('sample'),
            clock: new SystemClock(),
            eventIdGenerator: new RandomEventIdGenerator(),
        });

        await unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            await ctx.announcements.add(
                Announcement.create({ id: ANNOUNCEMENT_ID, name: 'A platform Announcement' }),
            );
            await ctx.announcements.add(
                Announcement.create({ id: CONCURRENCY_ANNOUNCEMENT_ID, name: 'Original name' }),
            );
        });
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    it('is visible under a platform scope', async () => {
        await unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            const found = await ctx.announcements.findById(ANNOUNCEMENT_ID);
            expect(found?.name).toBe('A platform Announcement');
        });
    });

    it('is also visible under an unrelated Club scope', async () => {
        await unitOfWork.run(
            ClubTransactionScope.of(
                asClubId('00000000-0000-4000-8000-000000000001'),
                asPrincipalId('00000000-0000-4000-8000-000000000011'),
            ),
            async (ctx) => {
                const found = await ctx.announcements.findById(ANNOUNCEMENT_ID);
                expect(found?.name).toBe('A platform Announcement');
            },
        );
    });

    it('is also visible under an unrelated exhibitor scope', async () => {
        await unitOfWork.run(
            ExhibitorTransactionScope.of(asPrincipalId('00000000-0000-4000-8000-000000000012')),
            async (ctx) => {
                const found = await ctx.announcements.findById(ANNOUNCEMENT_ID);
                expect(found?.name).toBe('A platform Announcement');
            },
        );
    });

    it('rejects a stale-version update and leaves the persisted row untouched', async () => {
        const [first, second] = await unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            const a = await ctx.announcements.findById(CONCURRENCY_ANNOUNCEMENT_ID);
            const b = await ctx.announcements.findById(CONCURRENCY_ANNOUNCEMENT_ID);
            if (a === undefined || b === undefined) throw new Error('fixture setup failed');
            return [a, b];
        });

        // The first writer's update succeeds against real Postgres and bumps the stored version.
        await unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            first.rename('First writer');
            await ctx.announcements.update(first);
        });

        // The second writer still holds the pre-bump version — the Drizzle
        // `UPDATE ... WHERE version` guard must reject it, not just the fake.
        second.rename('Second writer');
        await expect(
            unitOfWork.run(PlatformTransactionScope.of(), (ctx) =>
                ctx.announcements.update(second),
            ),
        ).rejects.toThrow(ConcurrentModificationError);

        await unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            const reloaded = await ctx.announcements.findById(CONCURRENCY_ANNOUNCEMENT_ID);
            expect(reloaded?.name).toBe('First writer');
        });
    });
});
