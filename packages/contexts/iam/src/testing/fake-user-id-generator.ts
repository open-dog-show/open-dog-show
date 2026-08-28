// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { asUserId, type UserId } from '../domain/domain-ids.js';
import type { UserIdGenerator } from '../domain/user-id-generator.js';

/**
 * In-memory {@link UserIdGenerator} for unit tests.
 *
 * Mints deterministic, sequentially-numbered ids (`<prefix>-1`, `<prefix>-2`,
 * …) so a test can assert exactly which id a first login received without
 * touching `crypto`.
 */
export class FakeUserIdGenerator implements UserIdGenerator {
    private counter = 0;

    constructor(private readonly prefix = 'user') {}

    generate(): UserId {
        this.counter += 1;
        return asUserId(`${this.prefix}-${this.counter}`);
    }
}
