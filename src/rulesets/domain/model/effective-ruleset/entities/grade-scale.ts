// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { GradeId, GradeScaleId, SpecialOutcomeId } from '../value-objects/domain-ids.js';

/** An ordinal quality grade within a {@link GradeScale} (e.g. Excellent, Very Good). */
export interface Grade {
    readonly id: GradeId;
    /** Lower ordinal = better grade; 0 is the best grade on the scale. */
    readonly ordinal: number;
}

/**
 * A non-ordinal special outcome a judge may assign instead of a {@link Grade}
 * (e.g. Disqualified, Cannot Be Judged).
 */
export interface SpecialOutcome {
    readonly id: SpecialOutcomeId;
}

/**
 * The ruleset-owned ordered set of quality grades for a Class, paired with
 * the minimum {@link Grade} required for a Dog to receive an ordinal Placement.
 */
export interface GradeScale {
    readonly id: GradeScaleId;
    /** All grades on this scale, ordered best-first (lowest ordinal first). */
    readonly grades: ReadonlyArray<Grade>;
    /** Minimum grade for a Dog to be eligible for an ordinal Placement. */
    readonly placeableThresholdId: GradeId;
    readonly specialOutcomes: ReadonlyArray<SpecialOutcome>;
}
