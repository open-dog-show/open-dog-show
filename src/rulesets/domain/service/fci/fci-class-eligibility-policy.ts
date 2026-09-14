// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from '../../model/effective-ruleset/entities/class-definition.js';
import type { ClassEligibilityPolicy } from '../class-eligibility-policy/class-eligibility-policy.js';
import type { EntryEligibilityProfile } from '../class-eligibility-policy/entry-eligibility-profile.js';
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
 *    `entryProfile.heldCertificates`.
 * 4. **Bred-by-Exhibitor** — when `classDefinition.bredByExhibitor` is
 *    `true`, `entryProfile.handlerIsBreederOfDog` must also be `true`.
 *
 * This is a pure in-memory domain service (ADR-0001: concrete rulesets are
 * pure domain modules that depend only on the domain core) — not a test
 * double. It lives in the domain layer (`domain/service/fci/`) and is exported
 * from the `domain/service/fci/` relative-import barrel, kept separate from
 * `src/rulesets/index.ts` so the main export stays the abstraction surface
 * (the ports + data model); the composition root (`apps/api`) will wire it.
 * See ADR-0021.
 *
 * **Reviewer note (ADR-0001's 2026-09-11 amendment):** `showDate` is used
 * only for the age evaluation above — this policy never branches on a date
 * or on which {@link RulesetLayerEdition} is in force. A rule that differs
 * between editions is edition data (a field on `ClassDefinition`), resolved
 * upstream by `resolveEffectiveRuleset` before this policy ever runs.
 */
export class FciClassEligibilityPolicy implements ClassEligibilityPolicy {
    isEligible(
        classDefinition: ClassDefinition,
        entryProfile: EntryEligibilityProfile,
        showDate: LocalDate,
    ): boolean {
        // A show date before the dog's date of birth is a corrupt profile (or
        // a mis-ordered show date); LocalDate.completedMonthsSince itself
        // rejects it (LocalDateBeforeReferenceError) rather than silently
        // filtering the dog out.
        const age = showDate.completedMonthsSince(entryProfile.dateOfBirth);

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
            if (!entryProfile.heldCertificates.includes(cert)) {
                return false;
            }
        }

        if (classDefinition.bredByExhibitor && !entryProfile.handlerIsBreederOfDog) {
            return false;
        }

        return true;
    }
}
