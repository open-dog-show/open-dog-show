// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export { Show, ShowNotFoundError } from './domain/model/show/show.js';
export type { ShowRepository } from './domain/model/show/show-repository.js';
export { Entry } from './domain/model/entry/entry.js';
export type { EntryInput } from './domain/model/entry/entry.js';
export {
    EntrySubmitted,
    ENTRY_SUBMITTED_TYPE,
} from './domain/model/entry/events/entry-submitted.js';
export type { EntrySubmittedPayload } from './domain/model/entry/events/entry-submitted.js';
export type { EntryRepository } from './domain/model/entry/entry-repository.js';
export type {
    SampleUnitOfWork,
    SampleUnitOfWorkContext,
} from './application/ports/unit-of-work.js';
export type { SaveEntryInput } from './application/save-entry/save-entry.js';
export { SaveEntryUseCase } from './application/save-entry/save-entry.js';
export { DrizzleShowRepository } from './infrastructure/persistence/postgres/drizzle-show-repository.js';
export { DrizzleEntryRepository } from './infrastructure/persistence/postgres/drizzle-entry-repository.js';
export { PgSampleUnitOfWork } from './infrastructure/persistence/postgres/pg-unit-of-work.js';
export { buildSampleEventRehydrationRegistry } from './infrastructure/messaging/sample-event-registry.js';
