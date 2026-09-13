// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import { PgOutboxWriter, PlatformTransactionScope } from '../../../../../src/Shared/index.js';
import { SystemClock } from '../../../../../src/Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../../src/Shared/infrastructure/random-event-id-generator.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';

/**
 * Proves the bare context skeleton — no aggregate yet — wires migrations,
 * RLS session variables, and the outbox transaction plumbing correctly: a
 * unit of work that records nothing still commits cleanly.
 */
describe('sample context skeleton — outbox plumbing', () => {
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
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    it('commits an empty unit of work with no rows written to the outbox', async () => {
        await expect(
            unitOfWork.run(PlatformTransactionScope.of(), async (ctx) => ctx),
        ).resolves.toBeDefined();

        const { rows } = await harness.superPool.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM sample.outbox`,
        );
        expect(rows[0]?.count).toBe('0');
    });
});
