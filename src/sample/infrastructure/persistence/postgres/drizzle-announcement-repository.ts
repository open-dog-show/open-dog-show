// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { asAnnouncementId, type AnnouncementId } from '../../../domain/shared/domain-ids.js';
import { announcementsTable } from './schema.js';
import { Announcement } from '../../../domain/model/announcement/announcement.js';
import type { AnnouncementRepository } from '../../../domain/model/announcement/announcement-repository.js';
import { AnnouncementPersistenceFailed } from './announcement-persistence-failed.js';

export class DrizzleAnnouncementRepository implements AnnouncementRepository {
    private readonly drizzle;

    constructor(client: pg.PoolClient) {
        this.drizzle = drizzle(client);
    }

    async findById(id: AnnouncementId): Promise<Announcement | undefined> {
        try {
            const [row] = await this.drizzle
                .select()
                .from(announcementsTable)
                .where(eq(announcementsTable.id, id));
            return row === undefined
                ? undefined
                : Announcement.rehydrate({ id: asAnnouncementId(row.id), name: row.name });
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new AnnouncementPersistenceFailed('reading a announcement', cause);
        }
    }

    async add(announcement: Announcement): Promise<void> {
        try {
            await this.drizzle.insert(announcementsTable).values({
                id: announcement.id,
                name: announcement.name,
            });
        } catch (cause) {
            throw new AnnouncementPersistenceFailed('adding a announcement', cause);
        }
    }

    async update(announcement: Announcement): Promise<void> {
        try {
            await this.drizzle
                .update(announcementsTable)
                .set({ name: announcement.name })
                .where(eq(announcementsTable.id, announcement.id));
        } catch (cause) {
            throw new AnnouncementPersistenceFailed('updating a announcement', cause);
        }
    }
}
