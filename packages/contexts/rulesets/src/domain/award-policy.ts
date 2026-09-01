// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId } from './domain-ids.js';
import type { EntryRef } from './entry-ref.js';
import type { EffectiveRuleset } from './effective-ruleset.js';
import type { JudgingScopeResults } from './judging-scope-results.js';

/**
 * A proposed assignment of one award type to one dog entry.
 */
export interface ProposedAwardAssignment {
    /** Opaque reference to the judged entry receiving the award. */
    readonly dogRef: EntryRef;
    readonly awardTypeId: AwardTypeId;
}

/**
 * The result of validating the judge's proposed award choices.
 * On failure, `reason` is a human-readable description of the first violation.
 */
export type AwardValidationResult =
    { readonly valid: true } | { readonly valid: false; readonly reason: string };

/**
 * Port: determines which Award Types may be proposed for a given judging
 * scope, and validates whether the judge's proposed choices are legal.
 *
 * The Judging context calls this policy without knowing which kennel-club
 * ruleset is in force.  The FCI in-memory implementation lives in the
 * `@ods/rulesets/testing` sub-path and can be used as a drop-in fake.
 */
export interface AwardPolicy {
    /**
     * Returns the Award Type IDs that the judge may propose for the given
     * judging scope, based on which dogs have been placed within it.
     */
    eligibleAwardTypes(
        scope: JudgingScopeResults,
        ruleset: EffectiveRuleset,
    ): ReadonlyArray<AwardTypeId>;

    /**
     * Validates the judge's proposed award assignments against the scope
     * results and the effective ruleset rules.
     *
     * Returns `{ valid: true }` when all proposed assignments are legal.
     * Returns `{ valid: false, reason }` for the first violation found.
     * A discretionary award that is simply not proposed is not a violation.
     */
    validateAwardChoices(
        scope: JudgingScopeResults,
        proposed: ReadonlyArray<ProposedAwardAssignment>,
        ruleset: EffectiveRuleset,
    ): AwardValidationResult;
}
