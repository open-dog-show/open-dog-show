// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Show } from './show.js';

/**
 * Persistence port for the {@link Show} aggregate.
 *
 * `findAll` returns a {@link ReadonlyArray} so callers cannot mutate the
 * repository's internal collection through the returned reference.
 */
export interface ShowRepository {
    findAll(): Promise<ReadonlyArray<Show>>;
    save(show: Show): Promise<void>;
}
