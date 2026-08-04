// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from '../domain/class-definition.js';
import type { ClassEligibilityPolicy } from '../domain/class-eligibility-policy.js';
import type { DogEligibilityProfile } from '../domain/dog-eligibility-profile.js';
import type { LocalDate } from '../domain/local-date.js';

/**
 * Returns the number of calendar days from `from` to `to`.
 * Uses `Date.UTC` to avoid DST pitfalls with {@link LocalDate} arithmetic.
 */
function daysBetween(from: LocalDate, to: LocalDate): number {
    const fromMs = Date.UTC(from.year, from.month - 1, from.day);
    const toMs = Date.UTC(to.year, to.month - 1, to.day);
    return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

/**
 * In-memory FCI implementation of {@link ClassEligibilityPolicy}.
 *
 * Rules evaluated in order — first failing condition short-circuits:
 * 1. **Age lower bound** — dog must be at least `minAgeDays` old on show day.
 * 2. **Age upper bound** — dog must be strictly younger than `maxAgeDays` on
 *    show day; a dog that reaches the boundary exactly moves to the higher
 *    class and is ineligible for the lower (FCI 2026; KMSH ART.23).
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
        const age = daysBetween(dogProfile.dateOfBirth, showDate);

        if (classDefinition.minAgeDays !== undefined && age < classDefinition.minAgeDays) {
            return false;
        }

        if (classDefinition.maxAgeDays !== undefined && age >= classDefinition.maxAgeDays) {
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
