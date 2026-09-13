// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Result, TransactionScope } from '../../../Shared/index.js';
import { asAnnouncementId } from '../../domain/shared/domain-ids.js';
import {
    AnnouncementNotFoundError,
    InvalidAnnouncementNameError,
} from '../../domain/model/announcement/announcement.js';
import type { SampleUnitOfWork } from '../ports/unit-of-work.js';

/** Inputs to {@link RenameAnnouncementHandler.execute}. */
export interface RenameAnnouncementCommand {
    /** Aggregate id of the Announcement to rename. */
    readonly id: string;
    readonly name: string;
}

/** Primitive view of the renamed Announcement (B4). */
export interface RenameAnnouncementResponse {
    readonly id: string;
    readonly name: string;
}

/**
 * Use case: rename an existing Announcement and record the
 * `sample.AnnouncementRenamed` fact in the same
 * transaction (ADR-0014).
 *
 * Ownership is not re-derived here — `findById` only returns a row the
 * caller's RLS-scoped connection can already see, so a successful lookup
 * already proves the caller may act on it; this is the one shared shape for
 * every ownership scope (ADR-0026).
 */
export class RenameAnnouncementHandler {
    constructor(private readonly unitOfWork: SampleUnitOfWork) {}

    async execute(
        command: RenameAnnouncementCommand,
        scope: TransactionScope,
    ): Promise<
        Result<RenameAnnouncementResponse, AnnouncementNotFoundError | InvalidAnnouncementNameError>
    > {
        try {
            return await this.unitOfWork.run<
                Result<
                    RenameAnnouncementResponse,
                    AnnouncementNotFoundError | InvalidAnnouncementNameError
                >
            >(scope, async (ctx) => {
                const id = asAnnouncementId(command.id);
                const announcement = await ctx.announcements.findById(id);
                if (announcement === undefined) {
                    throw new AnnouncementNotFoundError(id);
                }
                announcement.rename(command.name);
                await ctx.announcements.update(announcement);
                return { ok: true, value: { id: announcement.id, name: announcement.name } };
            });
        } catch (error) {
            if (
                error instanceof AnnouncementNotFoundError ||
                error instanceof InvalidAnnouncementNameError
            ) {
                return { ok: false, error };
            }
            throw error;
        }
    }
}
