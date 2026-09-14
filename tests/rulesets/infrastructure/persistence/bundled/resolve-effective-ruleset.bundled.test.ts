// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { resolveEffectiveRuleset } from '../../../../../src/rulesets/domain/service/resolve-effective-ruleset.js';
import { BundledRulesetLayerEditionRepository } from '../../../../../src/rulesets/infrastructure/persistence/bundled/bundled-ruleset-layer-edition-repository.js';
import {
    FCI_LAYER_ID,
    FCI_CLASS_BRED_BY_EXHIBITOR,
} from '../../../../../src/rulesets/infrastructure/persistence/bundled/fci/index.js';
import { asEffectiveRulesetId } from '../../../../../src/rulesets/domain/shared/domain-ids.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';

/**
 * End-to-end acceptance test (ADR-0029, issue #191): the same Ruleset layer
 * resolves to two different {@link EffectiveRuleset} snapshots for show
 * dates either side of a real FCI edition boundary — the Bred by Exhibitor
 * class, added by the FCI Show Regulations edition effective 2027-01-01
 * (`docs/research/fci-international-show-rules.md`), absent from the
 * 2026-01-01 edition (`docs/research/belgium-srsh-show-rules.md`).
 */
describe('resolveEffectiveRuleset — bundled FCI editions either side of 2027-01-01', () => {
    const repository = new BundledRulesetLayerEditionRepository();

    it('excludes Bred by Exhibitor for a show date under the 2026-01-01 edition', async () => {
        const ruleset = await resolveEffectiveRuleset({
            id: asEffectiveRulesetId('ruleset-1'),
            orderedLayerIds: [FCI_LAYER_ID],
            editionRepository: repository,
            showDate: LocalDate.of(2026, 12, 31),
        });

        expect(ruleset.classDefinitions).toHaveLength(9);
        expect(ruleset.classDefinition(FCI_CLASS_BRED_BY_EXHIBITOR)).toBeUndefined();
        expect(ruleset.sourceEditions).toEqual([
            { layerId: FCI_LAYER_ID, effectiveFrom: LocalDate.of(2026, 1, 1) },
        ]);
    });

    it('includes Bred by Exhibitor for a show date under the 2027-01-01 edition', async () => {
        const ruleset = await resolveEffectiveRuleset({
            id: asEffectiveRulesetId('ruleset-2'),
            orderedLayerIds: [FCI_LAYER_ID],
            editionRepository: repository,
            showDate: LocalDate.of(2027, 1, 1),
        });

        expect(ruleset.classDefinitions).toHaveLength(10);
        expect(ruleset.classDefinition(FCI_CLASS_BRED_BY_EXHIBITOR)).toBeDefined();
        expect(ruleset.sourceEditions).toEqual([
            { layerId: FCI_LAYER_ID, effectiveFrom: LocalDate.of(2027, 1, 1) },
        ]);
    });
});
