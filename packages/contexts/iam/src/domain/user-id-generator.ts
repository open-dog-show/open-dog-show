// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UserId } from './domain-ids.js';

/**
 * Injection port for minting a new {@link UserId}.
 *
 * Callers must never call `crypto.randomUUID()` directly; injecting
 * `UserIdGenerator` keeps user-creation logic deterministic and trivially
 * testable with an in-memory test double — the same inversion the kernel applies
 * to `EventIdGenerator`. `@ods/iam` owns its own `UserId` brand (ADR-0013), so
 * it owns this generator port rather than importing an id generator from the
 * kernel.
 */
export interface UserIdGenerator {
    /** Generates and returns a new branded {@link UserId}. */
    generate(): UserId;
}
