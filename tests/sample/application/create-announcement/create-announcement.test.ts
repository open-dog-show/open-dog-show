// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { PlatformTransactionScope } from '../../../../src/Shared/index.js';
import { FakeSampleUnitOfWork } from '../../../../src/sample/infrastructure/persistence/inmemory/fake-sample-unit-of-work.js';
import { CreateAnnouncementHandler } from '../../../../src/sample/application/create-announcement/create-announcement.js';

describe('CreateAnnouncementHandler', () => {
    it('creates an Announcement with no owner at all', async () => {
        const unitOfWork = new FakeSampleUnitOfWork();
        const handler = new CreateAnnouncementHandler(unitOfWork);

        const response = await handler.execute(
            { id: '00000000-0000-4000-8000-000000000021', name: 'A name' },
            PlatformTransactionScope.of(),
        );

        expect(response).toEqual({ id: '00000000-0000-4000-8000-000000000021', name: 'A name' });
        expect(unitOfWork.recordedEvents).toHaveLength(1);
        expect(unitOfWork.recordedEvents[0]?.type).toBe('sample.AnnouncementCreated');
    });
});
