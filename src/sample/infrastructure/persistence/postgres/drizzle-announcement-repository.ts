// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import type pg from 'pg';
import { asAnnouncementId, type AnnouncementId } from '../../../domain/shared/domain-ids.js';
import { ConcurrentModificationError } from '../../../domain/shared/concurrent-modification-error.js';
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
                : Announcement.rehydrate({
                      id: asAnnouncementId(row.id),
                      name: row.name,
                      version: row.version,
                  });
        } catch (cause) {
            // E3: wrap the raw drizzle/pg exception at the boundary.
            throw new AnnouncementPersistenceFailed('reading an announcement', cause);
        }
    }

    async add(announcement: Announcement): Promise<void> {
        try {
            await this.drizzle.insert(announcementsTable).values({
                id: announcement.id,
                name: announcement.name,
                version: announcement.version,
            });
        } catch (cause) {
            throw new AnnouncementPersistenceFailed('adding an announcement', cause);
        }
    }

    /** @throws {ConcurrentModificationError} when the stored version no longer matches `announcement.version`. */
    async update(announcement: Announcement): Promise<void> {
        try {
            const matchedRows = await this.drizzle
                .update(announcementsTable)
                .set({ name: announcement.name, version: announcement.version + 1 })
                .where(
                    and(
                        eq(announcementsTable.id, announcement.id),
                        eq(announcementsTable.version, announcement.version),
                    ),
                )
                .returning({ id: announcementsTable.id });
            if (matchedRows.length === 0) {
                throw new ConcurrentModificationError(
                    'Announcement',
                    announcement.id,
                    announcement.version,
                );
            }
        } catch (cause) {
            if (cause instanceof ConcurrentModificationError) throw cause;
            throw new AnnouncementPersistenceFailed('updating an announcement', cause);
        }
    }
}
