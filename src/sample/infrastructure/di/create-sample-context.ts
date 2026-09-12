// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import {
    PgOutboxWriter,
    type Clock,
    type EventIdGenerator,
    type DomainEventRehydrationRegistry,
} from '../../../Shared/index.js';
import { PgSampleUnitOfWork } from '../persistence/postgres/pg-unit-of-work.js';
import { buildSampleEventRehydrationRegistry } from '../messaging/sample-event-registry.js';
// plop:imports
import { CreateAnnouncementHandler } from '../../application/create-announcement/create-announcement.js';
import { RenameAnnouncementHandler } from '../../application/rename-announcement/rename-announcement.js';

import { CreateTicketHandler } from '../../application/create-ticket/create-ticket.js';
import { RenameTicketHandler } from '../../application/rename-ticket/rename-ticket.js';

import { CreateNoteHandler } from '../../application/create-note/create-note.js';
import { RenameNoteHandler } from '../../application/rename-note/rename-note.js';

import { CreateItemHandler } from '../../application/create-item/create-item.js';
import { RenameItemHandler } from '../../application/rename-item/rename-item.js';

/** Dependencies the composition root supplies to wire the sample context. */
export interface SampleContextDependencies {
    readonly pool: pg.Pool;
    readonly clock: Clock;
    readonly eventIdGenerator: EventIdGenerator;
}

/** The sample context's use cases and event rehydration registry. */
export interface SampleContext {
    readonly useCases: {
        // plop:usecases-type
        readonly createAnnouncement: CreateAnnouncementHandler;
        readonly renameAnnouncement: RenameAnnouncementHandler;

        readonly createTicket: CreateTicketHandler;
        readonly renameTicket: RenameTicketHandler;

        readonly createNote: CreateNoteHandler;
        readonly renameNote: RenameNoteHandler;

        readonly createItem: CreateItemHandler;
        readonly renameItem: RenameItemHandler;
    };
    readonly eventRegistry: DomainEventRehydrationRegistry;
}

/**
 * Wires the sample context's Postgres unit of work and use cases
 * from the given dependencies (ADR-0021's `infrastructure/di/`). The
 * composition root (`apps/`) is the only intended caller.
 */
export function createSampleContext(deps: SampleContextDependencies): SampleContext {
    const writer = new PgOutboxWriter('sample');
    const unitOfWork = new PgSampleUnitOfWork(deps.pool, writer, deps.clock, deps.eventIdGenerator);

    return {
        useCases: {
            // plop:usecases-instances
            createAnnouncement: new CreateAnnouncementHandler(unitOfWork),
            renameAnnouncement: new RenameAnnouncementHandler(unitOfWork),

            createTicket: new CreateTicketHandler(unitOfWork),
            renameTicket: new RenameTicketHandler(unitOfWork),

            createNote: new CreateNoteHandler(unitOfWork),
            renameNote: new RenameNoteHandler(unitOfWork),

            createItem: new CreateItemHandler(unitOfWork),
            renameItem: new RenameItemHandler(unitOfWork),
        },
        eventRegistry: buildSampleEventRehydrationRegistry(),
    };
}
