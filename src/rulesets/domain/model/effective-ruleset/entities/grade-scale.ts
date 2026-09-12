// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { GradeId, GradeScaleId, SpecialOutcomeId } from '../value-objects/domain-ids.js';
import type { GradeOrdinal } from '../value-objects/grade-ordinal.js';
import { asGradeOrdinal } from '../value-objects/grade-ordinal.js';
import { DomainError } from '../../../../../Shared/domain/domain-error.js';

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
    readonly ordinal: GradeOrdinal;

    private constructor(id: GradeId, ordinal: GradeOrdinal) {
        this.id = id;
        this.ordinal = ordinal;
    }

    static of(id: GradeId, ordinal: number): Grade {
        return new Grade(id, asGradeOrdinal(ordinal));
    }

    /**
     * True when this grade is at least as good as `minimum` — lower ordinal
     * = better grade. The ordering rule is not FCI-specific (it applies to
     * any Grade Scale), so it lives on the entity rather than in an
     * FCI-namespaced service.
     */
    isAtLeast(minimum: Grade): boolean {
        return this.ordinal <= minimum.ordinal;
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
 * Thrown by {@link GradeScale.of} when `placeableThresholdId` is not among
 * `grades`.
 */
export class UnknownPlaceableThresholdError extends DomainError {
    readonly gradeScaleId: GradeScaleId;
    readonly placeableThresholdId: GradeId;

    constructor(gradeScaleId: GradeScaleId, placeableThresholdId: GradeId) {
        super(
            `Grade scale '${gradeScaleId}' placeable threshold '${placeableThresholdId}' is not among its grades`,
            { gradeScaleId, placeableThresholdId },
        );
        this.gradeScaleId = gradeScaleId;
        this.placeableThresholdId = placeableThresholdId;
    }
}

/**
 * The ruleset-owned ordered set of quality grades for a Class, paired with
 * the minimum {@link Grade} required for a Dog to receive an ordinal Placement.
 *
 * An entity (ADR-0022): private constructor plus the {@link GradeScale.of}
 * factory is the only construction path. Identified by `id`, not by value.
 * The constructor rejects a `placeableThresholdId` not among `grades`
 * ({@link UnknownPlaceableThresholdError}) — a scale is always internally
 * consistent (ADR-0029).
 */
export class GradeScale {
    readonly id: GradeScaleId;
    readonly grades: ReadonlyArray<Grade>;
    readonly placeableThresholdId: GradeId;
    readonly specialOutcomes: ReadonlyArray<SpecialOutcome>;

    private constructor(attributes: GradeScaleAttributes) {
        if (!attributes.grades.some((g) => g.id === attributes.placeableThresholdId)) {
            throw new UnknownPlaceableThresholdError(
                attributes.id,
                attributes.placeableThresholdId,
            );
        }
        this.id = attributes.id;
        this.grades = [...attributes.grades];
        this.placeableThresholdId = attributes.placeableThresholdId;
        this.specialOutcomes = [...attributes.specialOutcomes];
    }

    static of(attributes: GradeScaleAttributes): GradeScale {
        return new GradeScale(attributes);
    }

    /** Returns the {@link Grade} with `id` on this scale, or `undefined` when absent. */
    grade(id: GradeId): Grade | undefined {
        return this.grades.find((g) => g.id === id);
    }
}
