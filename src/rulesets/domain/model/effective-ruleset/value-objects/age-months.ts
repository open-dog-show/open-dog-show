// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { Brand } from './domain-ids.js';
import { DomainError } from '../../../../../Shared/domain/domain-error.js';

/** Branded number: age in whole calendar months (ADR-0008). Bare `number` is interchangeable with ordinals/counts; the brand keeps the unit distinct at compile time, no runtime cost. */
export type AgeMonths = Brand<number, 'AgeMonths'>;

/** Thrown by {@link asAgeMonths} when `months` is not an integer >= 0. */
export class InvalidAgeMonthsError extends DomainError {
    readonly months: number;

    constructor(months: number) {
        super(`AgeMonths must be an integer >= 0; received ${months}`, { months });
        this.months = months;
    }
}

/** Casts a raw number to an {@link AgeMonths}, validating it is an integer >= 0. */
export const asAgeMonths = (months: number): AgeMonths => {
    if (!Number.isInteger(months) || months < 0) {
        throw new InvalidAgeMonthsError(months);
    }
    return months as AgeMonths;
};
