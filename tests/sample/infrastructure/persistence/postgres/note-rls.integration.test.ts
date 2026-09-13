// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresHarness } from '../../../../test-kit/index.js';
import { bootstrapSampleSchema } from '../../../fixtures.js';
import {
    asPrincipalId,
    ExhibitorTransactionScope,
    PgOutboxWriter,
} from '../../../../../src/Shared/index.js';
import { SystemClock } from '../../../../../src/Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../../src/Shared/infrastructure/random-event-id-generator.js';
import { PgSampleUnitOfWork } from '../../../../../src/sample/infrastructure/persistence/postgres/pg-unit-of-work.js';
import { Note } from '../../../../../src/sample/domain/model/note/note.js';
import { asNoteId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const PRINCIPAL_A_ID = asPrincipalId('00000000-0000-4000-8000-000000000011');
const PRINCIPAL_B_ID = asPrincipalId('00000000-0000-4000-8000-000000000012');
const NOTE_ID = asNoteId('00000000-0000-4000-8000-000000000021');

/** Proves the ADR-0005 `exhibitor` RLS policy: visible only to the creating exhibitor. */
describe('Note RLS isolation (exhibitor scope)', () => {
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

        await unitOfWork.run(ExhibitorTransactionScope.of(PRINCIPAL_A_ID), async (ctx) => {
            await ctx.notes.add(
                Note.create({
                    id: NOTE_ID,
                    createdBy: PRINCIPAL_A_ID,
                    name: 'Exhibitor A Note',
                }),
            );
        });
    }, 120_000);

    afterAll(async () => {
        await harness.stop();
    });

    it('exhibitor A can find their own Note', async () => {
        await unitOfWork.run(ExhibitorTransactionScope.of(PRINCIPAL_A_ID), async (ctx) => {
            const found = await ctx.notes.findById(NOTE_ID);
            expect(found?.name).toBe('Exhibitor A Note');
        });
    });

    it("exhibitor B cannot find exhibitor A's Note", async () => {
        await unitOfWork.run(ExhibitorTransactionScope.of(PRINCIPAL_B_ID), async (ctx) => {
            const found = await ctx.notes.findById(NOTE_ID);
            expect(found).toBeUndefined();
        });
    });
});
