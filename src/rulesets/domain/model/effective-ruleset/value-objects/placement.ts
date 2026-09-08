// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Brand } from '../../../shared/brand.js';

/**
 * Branded number: an ordinal class placement (1 = first, 2 = second, …).
 * Bare `number` is interchangeable with ordinals, counts, and ages; the brand
 * keeps the placement concept distinct at compile time, no runtime cost — the
 * same protection `AgeMonths` already has.
 */
export type Placement = Brand<number, 'Placement'>;

/** Casts a raw number to a {@link Placement}. Plain cast — no validation. */
export const asPlacement = (placement: number): Placement => placement as Placement;
