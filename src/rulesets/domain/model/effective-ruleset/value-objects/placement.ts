// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Brand } from '../../../shared/brand.js';
import { DomainError } from '../../../../../Shared/domain/domain-error.js';

/**
 * Branded number: an ordinal class placement (1 = first, 2 = second, …).
 * Bare `number` is interchangeable with ordinals, counts, and ages; the brand
 * keeps the placement concept distinct at compile time, no runtime cost — the
 * same protection `AgeMonths` already has.
 */
export type Placement = Brand<number, 'Placement'>;

/** Thrown by {@link asPlacement} when `placement` is not an integer >= 1. */
export class InvalidPlacementError extends DomainError {
    readonly placement: number;

    constructor(placement: number) {
        super(`Placement must be an integer >= 1; received ${placement}`, { placement });
        this.placement = placement;
    }
}

/** Casts a raw number to a {@link Placement}, validating it is an integer >= 1. */
export const asPlacement = (placement: number): Placement => {
    if (!Number.isInteger(placement) || placement < 1) {
        throw new InvalidPlacementError(placement);
    }
    return placement as Placement;
};
