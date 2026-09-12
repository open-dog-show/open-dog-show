// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Public surface of the sample context (ADR-0028): command/response
 * types, handler types, expected-outcome errors, event classes + `_TYPE`
 * constants + payload types, and the `createSampleContext` wiring
 * factory. Aggregates, repositories, ports, ORM adapters and fakes stay
 * internal — another context or `apps/` may import only what is exported
 * here; tests import internals by deep path.
 */
export { createSampleContext } from './infrastructure/di/create-sample-context.js';
export type {
    SampleContextDependencies,
    SampleContext,
} from './infrastructure/di/create-sample-context.js';
// plop:exports
export type {
    CreateAnnouncementCommand,
    CreateAnnouncementResponse,
} from './application/create-announcement/create-announcement.js';
export { CreateAnnouncementHandler } from './application/create-announcement/create-announcement.js';
export type {
    RenameAnnouncementCommand,
    RenameAnnouncementResponse,
} from './application/rename-announcement/rename-announcement.js';
export { RenameAnnouncementHandler } from './application/rename-announcement/rename-announcement.js';
export {
    InvalidAnnouncementNameError,
    AnnouncementNotFoundError,
} from './domain/model/announcement/announcement.js';
export {
    ANNOUNCEMENT_CREATED_TYPE,
    AnnouncementCreated,
} from './domain/model/announcement/events/announcement-created.js';
export type { AnnouncementCreatedPayload } from './domain/model/announcement/events/announcement-created.js';
export {
    ANNOUNCEMENT_RENAMED_TYPE,
    AnnouncementRenamed,
} from './domain/model/announcement/events/announcement-renamed.js';
export type { AnnouncementRenamedPayload } from './domain/model/announcement/events/announcement-renamed.js';

export type {
    CreateTicketCommand,
    CreateTicketResponse,
} from './application/create-ticket/create-ticket.js';
export { CreateTicketHandler } from './application/create-ticket/create-ticket.js';
export type {
    RenameTicketCommand,
    RenameTicketResponse,
} from './application/rename-ticket/rename-ticket.js';
export { RenameTicketHandler } from './application/rename-ticket/rename-ticket.js';
export { InvalidTicketNameError, TicketNotFoundError } from './domain/model/ticket/ticket.js';
export { TICKET_CREATED_TYPE, TicketCreated } from './domain/model/ticket/events/ticket-created.js';
export type { TicketCreatedPayload } from './domain/model/ticket/events/ticket-created.js';
export { TICKET_RENAMED_TYPE, TicketRenamed } from './domain/model/ticket/events/ticket-renamed.js';
export type { TicketRenamedPayload } from './domain/model/ticket/events/ticket-renamed.js';

export type {
    CreateNoteCommand,
    CreateNoteResponse,
} from './application/create-note/create-note.js';
export { CreateNoteHandler } from './application/create-note/create-note.js';
export type {
    RenameNoteCommand,
    RenameNoteResponse,
} from './application/rename-note/rename-note.js';
export { RenameNoteHandler } from './application/rename-note/rename-note.js';
export { InvalidNoteNameError, NoteNotFoundError } from './domain/model/note/note.js';
export { NOTE_CREATED_TYPE, NoteCreated } from './domain/model/note/events/note-created.js';
export type { NoteCreatedPayload } from './domain/model/note/events/note-created.js';
export { NOTE_RENAMED_TYPE, NoteRenamed } from './domain/model/note/events/note-renamed.js';
export type { NoteRenamedPayload } from './domain/model/note/events/note-renamed.js';

export type {
    CreateItemCommand,
    CreateItemResponse,
} from './application/create-item/create-item.js';
export { CreateItemHandler } from './application/create-item/create-item.js';
export type {
    RenameItemCommand,
    RenameItemResponse,
} from './application/rename-item/rename-item.js';
export { RenameItemHandler } from './application/rename-item/rename-item.js';
export { InvalidItemNameError, ItemNotFoundError } from './domain/model/item/item.js';
export { ITEM_CREATED_TYPE, ItemCreated } from './domain/model/item/events/item-created.js';
export type { ItemCreatedPayload } from './domain/model/item/events/item-created.js';
export { ITEM_RENAMED_TYPE, ItemRenamed } from './domain/model/item/events/item-renamed.js';
export type { ItemRenamedPayload } from './domain/model/item/events/item-renamed.js';
