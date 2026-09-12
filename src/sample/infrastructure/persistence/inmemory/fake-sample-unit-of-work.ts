// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    stampDomainEvent,
    type Clock,
    type DomainEvent,
    type EventIdGenerator,
    type TransactionScope,
} from '../../../../Shared/index.js';
import { SystemClock } from '../../../../Shared/infrastructure/system-clock.js';
import { RandomEventIdGenerator } from '../../../../Shared/infrastructure/random-event-id-generator.js';
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
 * without Docker. Captures saved entries and the domain events recorded by
 * them (stamped via the injected `clock` / `eventIdGenerator`, defaulting to
 * the real ports — pass fakes for deterministic assertions) so tests can
 * observe the effect of a use-case call through the public seam. Tests seed
 * `seededShows` up front to drive `SaveEntryUseCase`'s Show lookup.
 *
 * Lives in `infrastructure/persistence/inmemory/` (per AGENTS.md) rather than
 * inside a test file, so it is a reusable test double shared across the
 * sample-context suite.
 */
export class FakeSampleUnitOfWork implements SampleUnitOfWork {
    readonly savedEntries: Entry[] = [];
    readonly recordedEvents: DomainEvent[] = [];
    readonly seededShows: Show[] = [];

    readonly entries: EntryRepository;
    readonly shows: ShowRepository = {
        findAll: async () => [...this.seededShows],
        findById: async (id) => this.seededShows.find((show) => show.id === id),
        save: async (show) => {
            this.seededShows.push(show);
        },
    };

    constructor(
        private readonly clock: Clock = new SystemClock(),
        private readonly eventIdGenerator: EventIdGenerator = new RandomEventIdGenerator(),
    ) {
        this.entries = {
            findAll: async () => [...this.savedEntries],
            save: async (entry: Entry) => {
                this.savedEntries.push(entry);
                for (const fact of entry.pullEvents()) {
                    this.recordedEvents.push(
                        stampDomainEvent(fact, this.eventIdGenerator.generate(), this.clock.now()),
                    );
                }
            },
        };
    }

    async run<T>(
        _scope: TransactionScope,
        body: (ctx: SampleUnitOfWorkContext) => Promise<T>,
    ): Promise<T> {
        return body({ entries: this.entries, shows: this.shows });
    }
}
