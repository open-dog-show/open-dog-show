// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { Brand } from './domain-ids.js';

/** Branded number: age in whole calendar months (ADR-0008). Bare `number` is interchangeable with ordinals/counts; the brand keeps the unit distinct at compile time, no runtime cost. */
export type AgeMonths = Brand<number, 'AgeMonths'>;
/** Casts a raw number to an {@link AgeMonths}. */
export const asAgeMonths = (months: number): AgeMonths => months as AgeMonths;
