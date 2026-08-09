// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from '../domain/class-definition.js';
import type { ClassEligibilityPolicy } from '../domain/class-eligibility-policy.js';
import type { DogEligibilityProfile } from '../domain/dog-eligibility-profile.js';
import type { LocalDate } from '../domain/local-date.js';

/**
 * Returns the number of completed calendar months from `from` to `to`.
 * Mirrors FCI age evaluation: a dog born on the 4th reaches the next
 * month-age on the 4th of the subsequent month (FCI 2026; KMSH ART.23).
 */
function completedMonths(from: LocalDate, to: LocalDate): number {
    const months = (to.year - from.year) * 12 + (to.month - from.month);
    return to.day < from.day ? months - 1 : months;
}

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
 * This class lives in the `@ods/rulesets/testing` sub-path so the Entries
 * context can use it as a drop-in fake without pulling test tooling into
 * production bundles.
 */
export class FciClassEligibilityPolicy implements ClassEligibilityPolicy {
    isEligible(
        classDefinition: ClassDefinition,
        dogProfile: DogEligibilityProfile,
        showDate: LocalDate,
        handlerIsBreeder: boolean,
    ): boolean {
        const age = completedMonths(dogProfile.dateOfBirth, showDate);

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
