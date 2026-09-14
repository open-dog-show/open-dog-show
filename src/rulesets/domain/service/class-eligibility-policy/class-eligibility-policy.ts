// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from '../../model/effective-ruleset/entities/class-definition.js';
import type { EntryEligibilityProfile } from './entry-eligibility-profile.js';
import type { LocalDate } from '../../model/effective-ruleset/value-objects/local-date.js';

/**
 * Port: answers whether a Dog may enter a specific Class on a given show day.
 *
 * The Entries context calls this policy without knowing which kennel-club
 * ruleset is in force.  The FCI domain-service implementation lives in
 * `domain/service/fci/` (relative-import barrel); the composition root
 * (`apps/api`) will wire it. See ADR-0001 / ADR-0021.
 */
export interface ClassEligibilityPolicy {
    isEligible(
        classDefinition: ClassDefinition,
        entryProfile: EntryEligibilityProfile,
        showDate: LocalDate,
    ): boolean;
}
