// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { BundledRulesetLayerEditionRepository } from '../../../../../src/rulesets/infrastructure/persistence/bundled/bundled-ruleset-layer-edition-repository.js';
import { FCI_LAYER_ID } from '../../../../../src/rulesets/infrastructure/persistence/bundled/fci/index.js';
import { KMSH_LAYER_ID } from '../../../../../src/rulesets/infrastructure/persistence/bundled/kmsh/index.js';
import { asRulesetLayerId } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';

describe('BundledRulesetLayerEditionRepository', () => {
    const repository = new BundledRulesetLayerEditionRepository();

    it('returns undefined for a date before any bundled FCI edition is in force', async () => {
        const result = await repository.inForce(FCI_LAYER_ID, LocalDate.of(2025, 12, 31));

        expect(result).toBeUndefined();
    });

    it('returns the 2026-01-01 FCI edition for a date on or after it but before 2027-01-01', async () => {
        const result = await repository.inForce(FCI_LAYER_ID, LocalDate.of(2026, 6, 1));

        expect(result?.effectiveFrom).toEqual(LocalDate.of(2026, 1, 1));
    });

    it('returns the 2027-01-01 FCI edition for a date on or after it', async () => {
        const result = await repository.inForce(FCI_LAYER_ID, LocalDate.of(2027, 6, 1));

        expect(result?.effectiveFrom).toEqual(LocalDate.of(2027, 1, 1));
    });

    it('returns the bundled KMSH edition for a date on or after its effective date', async () => {
        const result = await repository.inForce(KMSH_LAYER_ID, LocalDate.of(2026, 6, 1));

        expect(result?.effectiveFrom).toEqual(LocalDate.of(2023, 1, 1));
    });

    it('returns undefined for a layer with no bundled editions', async () => {
        const result = await repository.inForce(asRulesetLayerId('akc'), LocalDate.of(2026, 6, 1));

        expect(result).toBeUndefined();
    });
});
