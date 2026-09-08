// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ShowTypeId, AwardTypeId } from '../value-objects/domain-ids.js';
import type { CollectiveCompetitionKind } from '../value-objects/collective-competition-results.js';

/**
 * A ruleset-owned classification of a Show (e.g. CAC-only, CAC-CACIB, Open,
 * Breed Special) that selects which Award types are in scope and which
 * catalogue-publication rules apply.
 */
export interface ShowType {
    readonly id: ShowTypeId;
    readonly availableAwardTypeIds: ReadonlyArray<AwardTypeId>;
    /** Collective competitions (Brace/Couple, Breeders\u2019 Group, Progeny Group)
     *  offered at this show type. Empty when none are available. */
    readonly availableCollectiveCompetitions: ReadonlyArray<CollectiveCompetitionKind>;
}
