// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ShowTypeId, AwardTypeId } from '../value-objects/domain-ids.js';
import type { CollectiveCompetitionKind } from '../value-objects/collective-competition-results.js';

/** Attributes for {@link ShowType.of}. */
export interface ShowTypeAttributes {
    readonly id: ShowTypeId;
    readonly availableAwardTypeIds: ReadonlyArray<AwardTypeId>;
    /** Collective competitions (Brace/Couple, Breeders' Group, Progeny Group)
     *  offered at this show type. Empty when none are available. */
    readonly availableCollectiveCompetitions: ReadonlyArray<CollectiveCompetitionKind>;
}

/**
 * A ruleset-owned classification of a Show (e.g. CAC-only, CAC-CACIB, Open,
 * Breed Special) that selects which Award types are in scope and which
 * catalogue-publication rules apply.
 *
 * An entity (ADR-0022): private constructor plus the {@link ShowType.of}
 * factory is the only construction path. Identified by `id`, not by value.
 */
export class ShowType {
    readonly id: ShowTypeId;
    readonly availableAwardTypeIds: ReadonlyArray<AwardTypeId>;
    readonly availableCollectiveCompetitions: ReadonlyArray<CollectiveCompetitionKind>;

    private constructor(attributes: ShowTypeAttributes) {
        this.id = attributes.id;
        this.availableAwardTypeIds = [...attributes.availableAwardTypeIds];
        this.availableCollectiveCompetitions = [...attributes.availableCollectiveCompetitions];
    }

    static of(attributes: ShowTypeAttributes): ShowType {
        return new ShowType(attributes);
    }
}
