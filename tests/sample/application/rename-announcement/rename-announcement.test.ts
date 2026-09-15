// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { PlatformTransactionScope } from '../../../../src/Shared/index.js';
import type { SampleUnitOfWork } from '../../../../src/sample/application/ports/unit-of-work.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateAnnouncementHandler } from '../../../../src/sample/application/create-announcement/create-announcement.js';
import { RenameAnnouncementHandler } from '../../../../src/sample/application/rename-announcement/rename-announcement.js';
import {
    Announcement,
    AnnouncementNotFoundError,
    InvalidAnnouncementNameError,
} from '../../../../src/sample/domain/model/announcement/announcement.js';
import { asAnnouncementId } from '../../../../src/sample/domain/shared/domain-ids.js';
import { ConcurrentModificationError } from '../../../../src/sample/domain/shared/concurrent-modification-error.js';

const SCOPE = PlatformTransactionScope.of();
const ANNOUNCEMENT_ID = asAnnouncementId('00000000-0000-4000-8000-000000000021');

describe('RenameAnnouncementHandler', () => {
    it('renames an existing Announcement', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        const result = await new RenameAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: true,
            value: { id: '00000000-0000-4000-8000-000000000021', name: 'New name' },
        });
        expect(unitOfWork.recordedEvents.at(-1)?.type).toBe('sample.AnnouncementRenamed');
    });

    it('returns AnnouncementNotFoundError for an unknown id', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();

        const result = await new RenameAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000099', name: 'New name' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: false,
            error: expect.any(AnnouncementNotFoundError) as AnnouncementNotFoundError,
        });
    });

    it('returns InvalidAnnouncementNameError for a blank name', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        const result = await new RenameAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: '   ' },
            SCOPE,
        );

        expect(result).toEqual({
            ok: false,
            error: expect.any(InvalidAnnouncementNameError) as InvalidAnnouncementNameError,
        });
    });

    it('propagates ConcurrentModificationError as a throw when a concurrent rename raced this one (E4)', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        // A concurrent writer renames first, bumping the stored version.
        await new RenameAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'First rename' },
            SCOPE,
        );

        // A raced unit of work whose `findById` returns a deliberately stale
        // (pre-bump) copy, so the handler's own `update` call collides with
        // the version already bumped above — the failure must propagate out
        // of `execute` as a throw, not a `Result` failure (E4).
        const staleUnitOfWork: SampleUnitOfWork = {
            run: (scope, body) =>
                unitOfWork.run(scope, (ctx) =>
                    body({
                        ...ctx,
                        announcements: {
                            ...ctx.announcements,
                            findById: () =>
                                Promise.resolve(
                                    Announcement.rehydrate({
                                        id: ANNOUNCEMENT_ID,
                                        name: 'Old name',
                                        version: 1,
                                    }),
                                ),
                        },
                    }),
                ),
        };

        await expect(
            new RenameAnnouncementHandler(staleUnitOfWork).execute(
                { id: '00000000-0000-4000-8000-000000000021', name: 'Second rename' },
                SCOPE,
            ),
        ).rejects.toThrow(ConcurrentModificationError);
    });

    it('rejects the losing writer when two run() calls genuinely overlap', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        await new CreateAnnouncementHandler(unitOfWork).execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'Old name' },
            SCOPE,
        );

        let releaseFirstWriter!: () => void;
        const secondWriterCommitted = new Promise<void>((resolve) => {
            releaseFirstWriter = resolve;
        });

        // The first `run()` reads, then suspends mid-transaction — genuinely
        // overlapping with a second `run()` that reads the same still-version-1
        // row and commits before the first resumes to write its own, now stale,
        // change. A whole-collection snapshot taken at the start of each `run()`
        // (the design this replaces) could not detect this: the first writer's
        // own snapshot would still show version 1 when it finally writes.
        const firstWriter = unitOfWork.run(SCOPE, async (ctx) => {
            const announcement = await ctx.announcements.findById(ANNOUNCEMENT_ID);
            if (announcement === undefined) throw new Error('fixture setup failed');
            await secondWriterCommitted;
            announcement.rename('First writer (stale)');
            await ctx.announcements.update(announcement);
        });

        await unitOfWork.run(SCOPE, async (ctx) => {
            const announcement = await ctx.announcements.findById(ANNOUNCEMENT_ID);
            if (announcement === undefined) throw new Error('fixture setup failed');
            announcement.rename('Second writer');
            await ctx.announcements.update(announcement);
        });
        releaseFirstWriter();

        await expect(firstWriter).rejects.toThrow(ConcurrentModificationError);
    });
});
