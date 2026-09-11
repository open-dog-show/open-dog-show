// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { DomainEvent, TransactionScope } from '../../../../Shared/index.js';
import type { Entry } from '../../../domain/model/entry/entry.js';
import type { EntryRepository } from '../../../domain/model/entry/entry-repository.js';
import type { Show } from '../../../domain/model/show/show.js';
import type { ShowRepository } from '../../../domain/model/show/show-repository.js';
import type {
    SampleUnitOfWork,
    SampleUnitOfWorkContext,
} from '../../../application/ports/unit-of-work.js';

/**
 * In-memory {@link SampleUnitOfWork} for unit-testing sample-context use cases
 * without Docker. Captures saved entries and appended events so assertions can
 * observe the effect of a use-case call through the public seam.
 *
 * Lives in `infrastructure/persistence/inmemory/` (per AGENTS.md) rather than
 * inside a test file, so it is a reusable test double shared across the
 * sample-context suite.
 */
export class FakeSampleUnitOfWork implements SampleUnitOfWork {
    readonly savedEntries: Entry[] = [];
    readonly appendedEvents: DomainEvent[] = [];

    readonly entries: EntryRepository = {
        findAll: async () => [...this.savedEntries],
        save: async (entry: Entry) => {
            this.savedEntries.push(entry);
        },
    };
    readonly shows: ShowRepository = {
        findAll: async () => [] as Show[],
        save: async () => {},
    };

    async run<T>(
        scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        return body({
            entries: this.entries,
            shows: this.shows,
            appendEvents: (...events: readonly DomainEvent[]) => {
                this.appendedEvents.push(...events);
            },
        });
    }
}
