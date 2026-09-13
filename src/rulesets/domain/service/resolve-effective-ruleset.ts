// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { EffectiveRuleset } from '../model/effective-ruleset/effective-ruleset.js';
import type {
    EffectiveRulesetId,
    RulesetLayerId,
} from '../model/effective-ruleset/value-objects/domain-ids.js';
import type { LocalDate } from '../model/effective-ruleset/value-objects/local-date.js';
import type { RulesetLayerEdition } from '../model/ruleset-layer-edition/ruleset-layer-edition.js';
import type { RulesetLayerEditionRepository } from '../model/ruleset-layer-edition/ruleset-layer-edition-repository.js';
import { DomainError } from '../../../Shared/domain/domain-error.js';

/**
 * Thrown by {@link resolveEffectiveRuleset} when `editionRepository` has no
 * {@link RulesetLayerEdition} of `layerId` in force on `date` — the Ruleset's
 * layer list names a layer that has not published any edition yet as of that
 * date.
 */
export class NoEditionInForceError extends DomainError {
    readonly layerId: RulesetLayerId;
    readonly date: LocalDate;

    constructor(layerId: RulesetLayerId, date: LocalDate) {
        super(
            `No edition of ruleset layer '${layerId}' is in force on ${date.year}-${date.month}-${date.day}`,
            {
                layerId,
                // Plain primitives, not the LocalDate instance itself — LocalDate
                // has no toJSON, so a structured logger reading `context` would
                // otherwise see an empty object (L4).
                date: { year: date.year, month: date.month, day: date.day },
            },
        );
        this.layerId = layerId;
        this.date = date;
    }
}

/**
 * Resolves a Show's {@link EffectiveRuleset} (ADR-0029): for each of the
 * Ruleset's ordered layers, fetches the latest {@link RulesetLayerEdition}
 * effective on or before `showDate` from `editionRepository`, then composes
 * them into a single validated snapshot via {@link EffectiveRuleset.resolve}.
 *
 * Only the edition-selection-by-date step lives here; the merge/validation
 * rules are the aggregate factory's (see {@link EffectiveRuleset.resolve}).
 *
 * @param orderedLayerIds The Ruleset's layers, base first (e.g.
 *                        `[FCI_LAYER_ID, KMSH_LAYER_ID]`) — layer order and
 *                        Rulesets persistence land with Show Organisation
 *                        (#17); until then callers supply the list directly.
 * @throws {NoEditionInForceError} when a layer has no edition in force on `showDate`.
 */
export async function resolveEffectiveRuleset(
    id: EffectiveRulesetId,
    orderedLayerIds: ReadonlyArray<RulesetLayerId>,
    editionRepository: RulesetLayerEditionRepository,
    showDate: LocalDate,
): Promise<EffectiveRuleset> {
    const editions: RulesetLayerEdition[] = [];
    for (const layerId of orderedLayerIds) {
        const edition = await editionRepository.inForce(layerId, showDate);
        if (edition === undefined) {
            throw new NoEditionInForceError(layerId, showDate);
        }
        editions.push(edition);
    }
    return EffectiveRuleset.resolve(id, editions, showDate);
}
