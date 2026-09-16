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
        // This construct-then-save shape repeats near-identically across the
        // 4 scope variants of every create-*.ts.hbs template — tracked in
        // #216 (four-scope template duplication), not fixed here.
        // create-hybrid.ts.hbs is the one variant that keeps validation
        // inside the transaction instead — see its createInTransaction doc
        // comment for why.
        let announcement: Announcement;
        try {
            announcement = Announcement.create({
                id: asAnnouncementId(command.id),
                name: command.name,
            });
        } catch (error) {
            if (error instanceof InvalidAnnouncementNameError) {
                return { ok: false, error };
            }
            throw error;
        }
        await this.unitOfWork.run(scope, async (ctx) => {
            await ctx.announcements.add(announcement);
        });
        return { ok: true, value: { id: announcement.id, name: announcement.name } };
    }
}
