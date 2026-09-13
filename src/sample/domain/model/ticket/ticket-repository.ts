// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Ticket } from './ticket.js';
import type { TicketId } from '../../shared/domain-ids.js';

/**
 * Persistence port for the Ticket aggregate.
 *
 * `add` is insert-only — a duplicate id fails loudly instead of silently
 * overwriting; changes go through `findById` → mutator → `update` (ADR-0026).
 */
export interface TicketRepository {
    findById(id: TicketId): Promise<Ticket | undefined>;
    add(ticket: Ticket): Promise<void>;
    update(ticket: Ticket): Promise<void>;
}
