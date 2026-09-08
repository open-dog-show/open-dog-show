// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Entry } from './entry.js';

/**
 * Persistence port for the {@link Entry} aggregate.
 *
 * `findAll` returns a {@link ReadonlyArray} so callers cannot mutate the
 * repository's internal collection through the returned reference.
 */
export interface EntryRepository {
    findAll(): Promise<ReadonlyArray<Entry>>;
    save(entry: Entry): Promise<void>;
}
