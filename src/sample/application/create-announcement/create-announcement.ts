// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../../../Shared/index.js';
import { asAnnouncementId } from '../../domain/shared/domain-ids.js';
import { Announcement } from '../../domain/model/announcement/announcement.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link CreateAnnouncementHandler.execute}. */
export interface CreateAnnouncementCommand {
    /** Aggregate id of the Announcement to create. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the created Announcement (B4). */
export interface CreateAnnouncementResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: create an Announcement — platform-wide data with no single
 * owner (ADR-0005) — and record the
 * `sample.AnnouncementCreated` fact in the same
 * transaction (ADR-0014). `scope` still drives the transaction (RLS session
 * variables), but is not narrowed to derive any owner id — a
 * Announcement has none.
 */
export class CreateAnnouncementHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    async execute(
        command: CreateAnnouncementCommand,
        scope: TransactionScope,
    ): Promise<CreateAnnouncementResponse> {
        return this.unitOfWork.run(scope, async (ctx) => {
            const announcement = Announcement.create({
                id: asAnnouncementId(command.id),
                name: command.name,
            });
            await ctx.announcements.add(announcement);
            return { id: announcement.id, name: announcement.name };
        });
    }
}
