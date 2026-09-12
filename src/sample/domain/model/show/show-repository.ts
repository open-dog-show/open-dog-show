// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Show } from './show.js';
import type { ShowId } from '../../shared/domain-ids.js';

/**
 * Persistence port for the {@link Show} aggregate.
 *
 * `findAll` returns a {@link ReadonlyArray} so callers cannot mutate the
 * repository's internal collection through the returned reference. `findById`
 * returns `undefined` for absence (N4) — used by `SaveEntryUseCase` to derive
 * an Entry's owning `clubId` from the Show it is submitted to, rather than
 * trusting a caller-supplied `clubId` (ADR-0026).
 */
export interface ShowRepository {
    findAll(): Promise<ReadonlyArray<Show>>;
    findById(id: ShowId): Promise<Show | undefined>;
    save(show: Show): Promise<void>;
}
