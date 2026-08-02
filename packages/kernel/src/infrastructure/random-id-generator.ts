// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../domain/domain-ports.js';

/** Production {@link IdGenerator} backed by `crypto.randomUUID()`. */
export class RandomIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
