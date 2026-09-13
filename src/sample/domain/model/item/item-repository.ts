// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Item } from './item.js';
import type { ItemId } from '../../shared/domain-ids.js';

/**
 * Persistence port for the Item aggregate.
 *
 * `add` is insert-only — a duplicate id fails loudly instead of silently
 * overwriting; changes go through `findById` → mutator → `update` (ADR-0026).
 */
export interface ItemRepository {
    findById(id: ItemId): Promise<Item | undefined>;
    add(item: Item): Promise<void>;
    update(item: Item): Promise<void>;
}
