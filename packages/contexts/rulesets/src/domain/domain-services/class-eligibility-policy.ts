// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from '../entities/class-definition.js';
import type { DogEligibilityProfile } from '../value-objects/dog-eligibility-profile.js';
import type { LocalDate } from '../value-objects/local-date.js';

/**
 * Port: answers whether a Dog may enter a specific Class on a given show day.
 *
 * The Entries context calls this policy without knowing which kennel-club
 * ruleset is in force.  The FCI in-memory implementation lives in the
 * `@ods/rulesets/testing` sub-path and can be used as a drop-in fake.
 */
export interface ClassEligibilityPolicy {
    isEligible(
        classDefinition: ClassDefinition,
        dogProfile: DogEligibilityProfile,
        showDate: LocalDate,
        handlerIsBreeder: boolean,
    ): boolean;
}
