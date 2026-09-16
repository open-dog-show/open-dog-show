// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Minimal find/add/update shape shared by every generated aggregate's
 * repository port. Both a context's Postgres (Drizzle) and in-memory (fake)
 * unit-of-work implementations conform to it structurally, so the same
 * wrapping/wiring logic can treat either uniformly instead of each
 * declaring its own copy of the same three methods.
 */
export interface CrudRepositoryPort<Id, T> {
    findById(id: Id): Promise<T | undefined>;
    add(entity: T): Promise<void>;
    update(entity: T): Promise<void>;
}
