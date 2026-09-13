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
    fciWorkingClass,
    fciChampionClass,
    fciVeteranClass,
    fciHonourClass,
} from './fci-shared-content.js';

/**
 * The FCI base {@link RulesetLayerEdition} effective from 2026-01-01 — the
 * FCI Show Regulations edition valid from that date
 * (`https://www.fci.be/medias/EXP-REG-en-20260101-22363.pdf`, as researched
 * in `docs/research/belgium-srsh-show-rules.md`).
 *
 * Nine class definitions (Minor Puppy, Puppy, Junior, Intermediate, Open,
 * Working, Champion, Veteran, Honour) — this edition predates the Bred by
 * Exhibitor class, which the FCI added only with the edition effective
 * 2027-01-01 (see `fci-2027-01-01.ts`); two grade scales (FCI Adult, FCI
 * Puppy); fifteen award types; one show type (CAC-CACIB).
 */
export const fci20260101: RulesetLayerEdition = RulesetLayerEdition.of({
    layerId: FCI_LAYER_ID,
    effectiveFrom: LocalDate.of(2026, 1, 1),
    classDefinitions: [
        fciMinorPuppyClass,
        fciPuppyClass,
        fciJuniorClass,
        fciIntermediateClass,
        fciOpenClass,
        fciWorkingClass,
        fciChampionClass,
        fciVeteranClass,
        fciHonourClass,
    ],
    gradeScales: fciGradeScales,
    awardTypes: fciAwardTypes,
    showTypes: fciShowTypes,
});
