// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { PlatformEventScope } from '../../../../../src/Shared/index.js';
import {
    Announcement,
    InvalidAnnouncementNameError,
} from '../../../../../src/sample/domain/model/announcement/announcement.js';
import { asAnnouncementId } from '../../../../../src/sample/domain/shared/domain-ids.js';

const ANNOUNCEMENT_ID = asAnnouncementId('00000000-0000-4000-8000-000000000021');

describe('Announcement', () => {
    it('create records AnnouncementCreated scoped platform-wide', () => {
        const announcement = Announcement.create({ id: ANNOUNCEMENT_ID, name: 'Original name' });

        const [event] = announcement.pullEvents();
        expect(event?.type).toBe('sample.AnnouncementCreated');
        expect(event?.scope).toEqual(PlatformEventScope.of());
        expect(event?.payload).toEqual({ name: 'Original name' });
        expect(announcement.name).toBe('Original name');
    });

    it('create rejects a blank name', () => {
        expect(() => Announcement.create({ id: ANNOUNCEMENT_ID, name: '   ' })).toThrow(
            InvalidAnnouncementNameError,
        );
    });

    it('rehydrate does not record an event', () => {
        const announcement = Announcement.rehydrate({
            id: ANNOUNCEMENT_ID,
            name: 'Restored name',
        });

        expect(announcement.pullEvents()).toEqual([]);
        expect(announcement.name).toBe('Restored name');
    });

    it('rename records AnnouncementRenamed and updates the name', () => {
        const announcement = Announcement.rehydrate({
            id: ANNOUNCEMENT_ID,
            name: 'Old name',
        });

        announcement.rename('New name');

        const [event] = announcement.pullEvents();
        expect(event?.type).toBe('sample.AnnouncementRenamed');
        expect(event?.scope).toEqual(PlatformEventScope.of());
        expect(event?.payload).toEqual({ name: 'New name' });
        expect(announcement.name).toBe('New name');
    });

    it('rename rejects a blank name', () => {
        const announcement = Announcement.rehydrate({
            id: ANNOUNCEMENT_ID,
            name: 'Old name',
        });

        expect(() => announcement.rename('')).toThrow(InvalidAnnouncementNameError);
    });
});
