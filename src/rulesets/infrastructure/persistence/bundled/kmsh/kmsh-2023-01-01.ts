// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { RulesetLayerEdition } from '../../../../domain/model/ruleset-layer-edition/ruleset-layer-edition.js';
import { LocalDate } from '../../../../domain/model/effective-ruleset/value-objects/local-date.js';
import { ClassDefinition } from '../../../../domain/model/effective-ruleset/entities/class-definition.js';
import {
    HigherScopeAwardType,
    PerSexAwardType,
    AwardFeeder,
    ClassFeeder,
} from '../../../../domain/model/effective-ruleset/entities/award-type.js';
import { ShowType } from '../../../../domain/model/effective-ruleset/entities/show-type.js';
import { asPlacement } from '../../../../domain/service/award-policy/placement.js';
import { asAgeMonths } from '../../../../domain/model/effective-ruleset/value-objects/age-months.js';
import { CERTIFICATE_KIND } from '../../../../domain/model/effective-ruleset/value-objects/certificate-kind.js';
import {
    FCI_PUPPY_GRADE_SCALE_ID,
    FCI_ADULT_GRADE_SCALE_ID,
    FCI_GRADE_EXCELLENT,
    FCI_AWARD_CACIB,
    FCI_AWARD_RES_CACIB,
    FCI_AWARD_CACIB_J,
    FCI_AWARD_CACIB_V,
    FCI_AWARD_BOB,
    FCI_AWARD_BOS,
    FCI_AWARD_BIG,
    FCI_AWARD_BIS,
    FCI_AWARD_BEST_JUNIOR,
    FCI_AWARD_BEST_VETERAN,
    FCI_AWARD_BEST_PUPPY,
    FCI_AWARD_BEST_MINOR_PUPPY,
    FCI_AWARD_BEST_BRACE,
    FCI_AWARD_BEST_BREEDERS_GROUP,
    FCI_AWARD_BEST_PROGENY_GROUP,
    FCI_CLASS_MINOR_PUPPY,
    FCI_CLASS_JUNIOR,
    FCI_CLASS_VETERAN,
} from '../fci/index.js';
import {
    KMSH_LAYER_ID,
    KMSH_AWARD_CAC,
    KMSH_AWARD_RCAC,
    KMSH_CLASS_FOKKERSKLAS,
    KMSH_SHOW_TYPE_NATIONAL_SHOW,
} from './kmsh-ids.js';

/**
 * The KMSH / SRSH (Koninklijke Maatschappij Sint-Hubertus / Société Royale
 * Saint-Hubert) national override {@link RulesetLayerEdition}, effective
 * from 2023-01-01 (Reglement van de Tentoonstellingen, Sectie 4A, 2023).
 *
 * Extends the FCI base layer with Belgian-specific rules:
 *
 * - **Minor Puppy class override** — ART.23 sets a lower age bound of 3
 *   months ("minimum 3 tot 6 maanden"); the FCI base layer has no floor.
 * - **Fokkersklas** — breeder class (ART.24, from 15 months, bredByExhibitor)
 *   that feeds CAC and RCAC.
 * - **CAC** — Belgian national certificate, per-sex, discretionary,
 *   Excellent-1st (Bijlage 1 §1a; toekennen niet verplicht in België).
 * - **RCAC** — Reserve CAC, per-sex, discretionary (Bijlage 1 §1a).
 *
 * The KMSH layer intentionally does NOT override the FCI grade scales —
 * language is not a rule difference (ADR-0010).
 *
 * No further edition has been researched; layer order (this composed after
 * an FCI edition) is supplied by the caller of `resolveEffectiveRuleset`
 * (layer ordering is the Ruleset's ordered layer list, ADR-0029 — Rulesets
 * persistence lands with Show Organisation, #17).
 */
export const kmsh20230101: RulesetLayerEdition = RulesetLayerEdition.of({
    layerId: KMSH_LAYER_ID,
    effectiveFrom: LocalDate.of(2023, 1, 1),
    classDefinitions: [
        // Override Minor Puppy: KMSH ART.23 specifies minimum 3 months
        // ("minimum 3 tot 6 maanden"), unlike FCI which has no numeric floor.
        ClassDefinition.of({
            id: FCI_CLASS_MINOR_PUPPY,
            fromAgeMonths: asAgeMonths(3),
            lessThanAgeMonths: asAgeMonths(6),
            requiredCertificates: [CERTIFICATE_KIND.VaccinationCertificate],
            bredByExhibitor: false,
            gradeScaleId: FCI_PUPPY_GRADE_SCALE_ID,
            awardTypeIds: [],
        }),
        // Fokkersklas (ART.24): available at breed-specific shows; feeds CAC + RCAC.
        ClassDefinition.of({
            id: KMSH_CLASS_FOKKERSKLAS,
            fromAgeMonths: asAgeMonths(15),
            lessThanAgeMonths: undefined,
            requiredCertificates: [],
            bredByExhibitor: true,
            gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
            awardTypeIds: [KMSH_AWARD_CAC, KMSH_AWARD_RCAC],
        }),
    ],
    gradeScales: [], // No grade scale overrides — language is not a rule difference (ADR-0010)
    awardTypes: [
        PerSexAwardType.of({
            id: KMSH_AWARD_CAC,
            minimumGradeId: FCI_GRADE_EXCELLENT,
            worstEligiblePlacement: asPlacement(1),
            isDiscretionary: true,
        }),
        PerSexAwardType.of({
            // Bijlage 1 §1a: remaining dogs + 2nd-placed dog from the class
            // where CAC was awarded compete for RCAC (eventueel = not mandatory).
            id: KMSH_AWARD_RCAC,
            minimumGradeId: FCI_GRADE_EXCELLENT,
            worstEligiblePlacement: undefined,
            isDiscretionary: true,
        }),
        // -------------------------------------------------------------------
        // ADR-0017: BOB/BOS wholesale override — last-layer-wins replaces the
        // FCI-layer BOB/BOS entirely, adding the national CAC adult feeder
        // (KMSH Bijlage 1 §4: the adult may hold "CAC/CACIB"). The junior and
        // veteran class-win feeders are retained. At a CAC-only show no CACIB
        // stream is present, so BOB feeds off the CAC stream + class wins
        // (Bijlage 2 §2-3); at a CACIB show the CACIB stream feeds BOB instead.
        // -------------------------------------------------------------------
        HigherScopeAwardType.breed({
            id: FCI_AWARD_BOB,
            minimumGradeId: FCI_GRADE_EXCELLENT,
            worstEligiblePlacement: undefined,
            isDiscretionary: false,
            fedBy: [
                AwardFeeder.of(FCI_AWARD_CACIB),
                AwardFeeder.of(KMSH_AWARD_CAC),
                ClassFeeder.of(FCI_CLASS_JUNIOR),
                ClassFeeder.of(FCI_CLASS_VETERAN),
            ],
        }),
        HigherScopeAwardType.breed({
            id: FCI_AWARD_BOS,
            minimumGradeId: FCI_GRADE_EXCELLENT,
            worstEligiblePlacement: undefined,
            isDiscretionary: false,
            fedBy: [
                AwardFeeder.of(FCI_AWARD_CACIB),
                AwardFeeder.of(KMSH_AWARD_CAC),
                ClassFeeder.of(FCI_CLASS_JUNIOR),
                ClassFeeder.of(FCI_CLASS_VETERAN),
            ],
        }),
    ],
    showTypes: [
        ShowType.of({
            id: KMSH_SHOW_TYPE_NATIONAL_SHOW,
            availableAwardTypeIds: [
                KMSH_AWARD_CAC,
                KMSH_AWARD_RCAC,
                FCI_AWARD_CACIB,
                FCI_AWARD_RES_CACIB,
                FCI_AWARD_CACIB_J,
                FCI_AWARD_CACIB_V,
                FCI_AWARD_BOB,
                FCI_AWARD_BOS,
                FCI_AWARD_BIG,
                FCI_AWARD_BIS,
                FCI_AWARD_BEST_JUNIOR,
                FCI_AWARD_BEST_VETERAN,
                FCI_AWARD_BEST_PUPPY,
                FCI_AWARD_BEST_MINOR_PUPPY,
                FCI_AWARD_BEST_BRACE,
                FCI_AWARD_BEST_BREEDERS_GROUP,
                FCI_AWARD_BEST_PROGENY_GROUP,
            ],
            availableCollectiveCompetitions: ['brace-couple', 'breeders-group', 'progeny-group'],
        }),
    ],
});
