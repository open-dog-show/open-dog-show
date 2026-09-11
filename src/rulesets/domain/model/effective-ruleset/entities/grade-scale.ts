// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { GradeId, GradeScaleId, SpecialOutcomeId } from '../value-objects/domain-ids.js';

/**
 * An ordinal quality grade within a {@link GradeScale} (e.g. Excellent, Very
 * Good).
 *
 * An entity (ADR-0022): private constructor plus the {@link Grade.of}
 * factory is the only construction path.
 */
export class Grade {
    readonly id: GradeId;
    /** Lower ordinal = better grade; 0 is the best grade on the scale. */
    readonly ordinal: number;

    private constructor(id: GradeId, ordinal: number) {
        this.id = id;
        this.ordinal = ordinal;
    }

    static of(id: GradeId, ordinal: number): Grade {
        return new Grade(id, ordinal);
    }
}

/**
 * A non-ordinal special outcome a judge may assign instead of a {@link Grade}
 * (e.g. Disqualified, Cannot Be Judged).
 *
 * An entity (ADR-0022): private constructor plus the {@link
 * SpecialOutcome.of} factory is the only construction path.
 */
export class SpecialOutcome {
    readonly id: SpecialOutcomeId;

    private constructor(id: SpecialOutcomeId) {
        this.id = id;
    }

    static of(id: SpecialOutcomeId): SpecialOutcome {
        return new SpecialOutcome(id);
    }
}

/** Attributes for {@link GradeScale.of}. */
export interface GradeScaleAttributes {
    readonly id: GradeScaleId;
    /** All grades on this scale, ordered best-first (lowest ordinal first). */
    readonly grades: ReadonlyArray<Grade>;
    /** Minimum grade for a Dog to be eligible for an ordinal Placement. */
    readonly placeableThresholdId: GradeId;
    readonly specialOutcomes: ReadonlyArray<SpecialOutcome>;
}

/**
 * The ruleset-owned ordered set of quality grades for a Class, paired with
 * the minimum {@link Grade} required for a Dog to receive an ordinal Placement.
 *
 * An entity (ADR-0022): private constructor plus the {@link GradeScale.of}
 * factory is the only construction path. Identified by `id`, not by value.
 */
export class GradeScale {
    readonly id: GradeScaleId;
    readonly grades: ReadonlyArray<Grade>;
    readonly placeableThresholdId: GradeId;
    readonly specialOutcomes: ReadonlyArray<SpecialOutcome>;

    private constructor(attributes: GradeScaleAttributes) {
        this.id = attributes.id;
        this.grades = [...attributes.grades];
        this.placeableThresholdId = attributes.placeableThresholdId;
        this.specialOutcomes = [...attributes.specialOutcomes];
    }

    static of(attributes: GradeScaleAttributes): GradeScale {
        return new GradeScale(attributes);
    }
}
