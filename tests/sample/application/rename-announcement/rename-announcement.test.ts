// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { PlatformTransactionScope } from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateAnnouncementHandler } from '../../../../src/sample/application/create-announcement/create-announcement.js';
import { RenameAnnouncementHandler } from '../../../../src/sample/application/rename-announcement/rename-announcement.js';
import {
    AnnouncementNotFoundError,
    InvalidAnnouncementNameError,
} from '../../../../src/sample/domain/model/announcement/announcement.js';

const SCOPE = PlatformTransactionScope.of();

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

        expect(result).toEqual({ ok: false, error: expect.any(AnnouncementNotFoundError) });
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

        expect(result).toEqual({ ok: false, error: expect.any(InvalidAnnouncementNameError) });
    });
});
