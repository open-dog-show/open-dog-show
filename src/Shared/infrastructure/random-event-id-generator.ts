// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';
import type { EventIdGenerator } from '../domain/domain-ports.js';
import { asEventId, type EventId } from '../domain/domain-ids.js';

/** Production {@link EventIdGenerator} backed by `crypto.randomUUID()`. */
export class RandomEventIdGenerator implements EventIdGenerator {
    generate(): EventId {
        return asEventId(randomUUID());
    }
}
