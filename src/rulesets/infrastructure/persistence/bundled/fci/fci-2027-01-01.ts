// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { RulesetLayerEdition } from '../../../../domain/model/ruleset-layer-edition/ruleset-layer-edition.js';
import { LocalDate } from '../../../../domain/model/effective-ruleset/value-objects/local-date.js';
import { FCI_LAYER_ID } from './fci-ids.js';
import {
    fciGradeScales,
    fciAwardTypes,
    fciShowTypes,
    fciMinorPuppyClass,
    fciPuppyClass,
    fciJuniorClass,
    fciIntermediateClass,
    fciOpenClass,
    fciBredByExhibitorClass,
    fciWorkingClass,
    fciChampionClass,
    fciVeteranClass,
    fciHonourClass,
} from './fci-shared-content.js';

/**
 * The FCI base {@link RulesetLayerEdition} effective from 2027-01-01 — the
 * consolidated FCI Show Regulations carrying the May 2025 Budapest
 * amendments, effective 1 Jan 2027
 * (`https://www.fci.be/medias/EXP-REG-en-20270101-22481.pdf`, as researched
 * in `docs/research/fci-international-show-rules.md`).
 *
 * Adds the **Bred by Exhibitor** class (from 15 months; handler must be the
 * dog's breeder or co-breeder; feeds CACIB + Reserve CACIB) to the nine
 * classes of the 2026-01-01 edition (see `fci-2026-01-01.ts`) — ten class
 * definitions in the FCI-recommended judging sequence (Section 5e). Grade
 * scales, award types and show types are unchanged from the 2026-01-01
 * edition.
 */
export const fci20270101: RulesetLayerEdition = RulesetLayerEdition.of({
    layerId: FCI_LAYER_ID,
    effectiveFrom: LocalDate.of(2027, 1, 1),
    classDefinitions: [
        fciMinorPuppyClass,
        fciPuppyClass,
        fciJuniorClass,
        fciIntermediateClass,
        fciOpenClass,
        fciBredByExhibitorClass,
        fciWorkingClass,
        fciChampionClass,
        fciVeteranClass,
        fciHonourClass,
    ],
    gradeScales: fciGradeScales,
    awardTypes: fciAwardTypes,
    showTypes: fciShowTypes,
});
