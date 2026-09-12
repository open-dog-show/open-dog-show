// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Brand } from '../../../shared/brand.js';
import { DomainError } from '../../../../../Shared/domain/domain-error.js';

/**
 * Branded number: a Grade's ordinal rank on its scale (0 = best). Bare
 * `number` is interchangeable with ages, placements, and counts; the brand
 * keeps ordinal distinct at compile time, no runtime cost — the same
 * protection `AgeMonths`/`Placement` already have.
 */
export type GradeOrdinal = Brand<number, 'GradeOrdinal'>;

/** Thrown by {@link asGradeOrdinal} when `ordinal` is not an integer >= 0. */
export class InvalidGradeOrdinalError extends DomainError {
    readonly ordinal: number;

    constructor(ordinal: number) {
        super(
            `Grade ordinal must be an integer >= 0 (0 is the best grade on the scale); received ${ordinal}`,
            { ordinal },
        );
        this.ordinal = ordinal;
    }
}

/** Casts a raw number to a {@link GradeOrdinal}, validating it is an integer >= 0. */
export const asGradeOrdinal = (ordinal: number): GradeOrdinal => {
    if (!Number.isInteger(ordinal) || ordinal < 0) {
        throw new InvalidGradeOrdinalError(ordinal);
    }
    return ordinal as GradeOrdinal;
};
