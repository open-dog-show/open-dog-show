// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../../../Shared/index.js';
// plop:imports
import type { AnnouncementRepository } from '../../domain/model/announcement/announcement-repository.js';

import type { TicketRepository } from '../../domain/model/ticket/ticket-repository.js';

import type { NoteRepository } from '../../domain/model/note/note-repository.js';

import type { ItemRepository } from '../../domain/model/item/item-repository.js';

/**
 * The repositories available inside one sample unit of work (ADR-0014).
 *
 * Lists repositories only (ADR-0027) — a use case never appends events
 * itself; an aggregate root records its own facts (`this.record(...)`,
 * `AggregateRoot.pullEvents()`) and the unit-of-work implementation pulls and
 * stamps them when a repository's `add`/`update` is called.
 */
export interface SampleUnitOfWorkContext {
    // plop:repositories
    readonly announcements: AnnouncementRepository;

    readonly tickets: TicketRepository;

    readonly notes: NoteRepository;

    readonly items: ItemRepository;
}

/**
 * Per-context unit-of-work port (ADR-0014).
 *
 * Opens a transaction scoped to `scope` (setting the RLS session variables),
 * constructs the context's repositories inside it, runs `body`, then commits
 * — atomically writing any recorded domain facts to the outbox before commit
 * (or rolling back on error).
 */
export interface SampleUnitOfWork {
    run<T>(scope: TransactionScope, body: (ctx: SampleUnitOfWorkContext) => Promise<T>): Promise<T>;
}
