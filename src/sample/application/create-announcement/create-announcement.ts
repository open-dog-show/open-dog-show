// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Result, TransactionScope } from '../../../Shared/index.js';
import { asAnnouncementId } from '../../domain/shared/domain-ids.js';
import {
    Announcement,
    InvalidAnnouncementNameError,
} from '../../domain/model/announcement/announcement.js';
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
    ): Promise<Result<CreateAnnouncementResponse, InvalidAnnouncementNameError>> {
        try {
            return await this.unitOfWork.run<
                Result<CreateAnnouncementResponse, InvalidAnnouncementNameError>
            >(scope, async (ctx) => {
                const announcement = Announcement.create({
                    id: asAnnouncementId(command.id),
                    name: command.name,
                });
                await ctx.announcements.add(announcement);
                return { ok: true, value: { id: announcement.id, name: announcement.name } };
            });
        } catch (error) {
            if (error instanceof InvalidAnnouncementNameError) {
                return { ok: false, error };
            }
            throw error;
        }
    }
}
