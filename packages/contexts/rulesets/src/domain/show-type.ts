// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ShowTypeId, AwardTypeId } from './domain-ids.js';

/**
 * A ruleset-owned classification of a Show (e.g. CAC-only, CAC-CACIB, Open,
 * Breed Special) that selects which Award types are in scope and which
 * catalogue-publication rules apply.
 */
export interface ShowType {
    readonly id: ShowTypeId;
    readonly name: string;
    readonly availableAwardTypeIds: ReadonlyArray<AwardTypeId>;
}
