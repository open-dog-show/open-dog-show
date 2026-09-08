// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from '../../model/effective-ruleset/entities/class-definition.js';
import type { ClassEligibilityPolicy } from '../class-eligibility-policy.js';
import type { DogEligibilityProfile } from '../../model/effective-ruleset/value-objects/dog-eligibility-profile.js';
import type { LocalDate } from '../../model/effective-ruleset/value-objects/local-date.js';

/**
 * In-memory FCI implementation of {@link ClassEligibilityPolicy}.
 *
 * Rules evaluated in order — first failing condition short-circuits:
 * 1. **Age lower bound** — dog must have reached at least `fromAgeMonths` completed
 *    calendar months on show day.
 * 2. **Age upper bound** — dog must have fewer than `lessThanAgeMonths` completed
 *    calendar months on show day; a dog that reaches the boundary exactly moves
 *    to the higher class and is ineligible for the lower (FCI 2026; KMSH ART.23).
 * 3. **Required certificates** — every certificate in
 *    `classDefinition.requiredCertificates` must appear in
 *    `dogProfile.heldCertificates`.
 * 4. **Bred-by-Exhibitor** — when `classDefinition.bredByExhibitor` is
 *    `true`, `handlerIsBreeder` must also be `true`.
 *
 * This is a pure in-memory domain service (ADR-0001: concrete rulesets are
 * pure domain modules that depend only on the domain core). It lives in
 * `domain/services/fci/` and is exported via the `@ods/rulesets/fci` sub-path
 * so the main `@ods/rulesets` export stays the abstraction surface (the ports
 * + data model); the composition root (`apps/api`) will wire it. See ADR-0019
 * § "Subpath exports".
 */
export class FciClassEligibilityPolicy implements ClassEligibilityPolicy {
    isEligible(
        classDefinition: ClassDefinition,
        dogProfile: DogEligibilityProfile,
        showDate: LocalDate,
        handlerIsBreeder: boolean,
    ): boolean {
        const age = showDate.completedMonthsSince(dogProfile.dateOfBirth);

        if (age < 0) {
            return false; // show date is before date of birth — fail closed
        }

        if (classDefinition.fromAgeMonths !== undefined && age < classDefinition.fromAgeMonths) {
            return false;
        }

        if (
            classDefinition.lessThanAgeMonths !== undefined &&
            age >= classDefinition.lessThanAgeMonths
        ) {
            return false;
        }

        for (const cert of classDefinition.requiredCertificates) {
            if (!dogProfile.heldCertificates.includes(cert)) {
                return false;
            }
        }

        if (classDefinition.bredByExhibitor && !handlerIsBreeder) {
            return false;
        }

        return true;
    }
}
