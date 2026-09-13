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

const ANNOUNCEMENT_ID = asAnnouncementId('00000000-0000-4000-8000-000000000021');

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
        unitOfWork = new PgSampleUnitOfWork(
            harness.appUserPool,
            new PgOutboxWriter('sample'),
            new SystemClock(),
            new RandomEventIdGenerator(),
        );

        await unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => {
            await ctx.announcements.add(
                Announcement.create({ id: ANNOUNCEMENT_ID, name: 'A platform Announcement' }),
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
});
