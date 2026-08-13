// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayer } from '../domain/ruleset-layer.js';
import { asRulesetLayerId, asClassId, asAwardTypeId, asShowTypeId } from '../domain/domain-ids.js';
import { CertificateKind } from '../domain/certificate-kind.js';
import {
    FCI_LAYER_ID,
    FCI_GRADE_SCALE_ID,
    FCI_PUPPY_GRADE_SCALE_ID,
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
} from './fci-ruleset-layer.js';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export const KMSH_LAYER_ID = asRulesetLayerId('kmsh');

/**
 * National CAC (Certificaat Aanleg voor het Kampioenschap /
 * Certificat d'Aptitude au Championnat) — Belgian national qualification
 * for the Champion title, awarded per-sex at national shows.
 * Toekennen van CAC is niet verplicht in België (Bijlage 1 §1a).
 */
export const KMSH_AWARD_CAC = asAwardTypeId('cac');

/**
 * Reserve CAC (RCAC) — Bijlage 1 §1a: awarded to the best dog from the
 * remaining CACIB-eligible-class dogs plus the 2nd-placed dog from the
 * class where the CAC was awarded, provided it received Excellent.
 * Not compulsory.
 */
export const KMSH_AWARD_RCAC = asAwardTypeId('rcac');

/**
 * Fokkersklas / Classe des éleveurs — KMSH national class available at
 * breed-specific shows (ART.24). Handler must be the breeder of the dog
 * (bredByExhibitor). Eligible for CAC and RCAC.
 */
export const KMSH_CLASS_FOKKERSKLAS = asClassId('fokkersklas');

// ---------------------------------------------------------------------------
// KMSH / SRSH national override RulesetLayer
// ---------------------------------------------------------------------------

/**
 * The KMSH / SRSH (Koninklijke Maatschappij Sint-Hubertus /
 * Société Royale Saint-Hubert) national override {@link RulesetLayer}.
 *
 * Extends the FCI base layer with Belgian-specific rules
 * (Reglement van de Tentoonstellingen, Sectie 4A, 2023):
 *
 * - **Minor Puppy class override** — ART.23 sets a lower age bound of 3
 *   months ("minimum 3 tot 6 maanden"); the FCI base layer has no floor.
 * - **Fokkersklas** — breeder class (ART.24, from 15 months, bredByExhibitor)
 *   that feeds CAC and RCAC.
 * - **CAC** — Belgian national certificate, per-sex, discretionary,
 *   Excellent-1st (Bijlage 1 §1a; toekennen niet verplicht in België).
 * - **RCAC** — Reserve CAC, per-sex, discretionary (Bijlage 1 §1a).
 *
 * Note: grade scale names are single strings pending the Multilingual Label
 * refactor (ADR-0010). The KMSH layer intentionally does NOT override the
 * FCI grade scales — language is not a rule difference.
 *
 * Compose as `resolveEffectiveRuleset([fciLayer, kmshLayer], date)`.
 */
export const kmshLayer: RulesetLayer = {
    id:            KMSH_LAYER_ID,
    name:          'KMSH / SRSH',
    parentLayerId: FCI_LAYER_ID,
    classDefinitions: [
        // Override Minor Puppy: KMSH ART.23 specifies minimum 3 months
        // ("minimum 3 tot 6 maanden"), unlike FCI which has no numeric floor.
        {
            id:                   asClassId('minor-puppy'),
            name:                 'Minor Puppyklas',
            fromAgeMonths:        3,
            lessThanAgeMonths:    6,
            requiredCertificates: [CertificateKind.Vaccination],
            bredByExhibitor:      false,
            gradeScaleId:         FCI_PUPPY_GRADE_SCALE_ID,
            awardTypeIds:         [],
        },
        // Fokkersklas (ART.24): available at breed-specific shows; feeds CAC + RCAC.
        {
            id:                   KMSH_CLASS_FOKKERSKLAS,
            name:                 'Fokkersklas',
            fromAgeMonths:        15,
            lessThanAgeMonths:    undefined,
            requiredCertificates: [],
            bredByExhibitor:      true,
            gradeScaleId:         FCI_GRADE_SCALE_ID,
            awardTypeIds:         [KMSH_AWARD_CAC, KMSH_AWARD_RCAC],
        },
    ],
    gradeScales: [], // No grade scale overrides — language is not a rule difference (ADR-0010)
    awardTypes: [
        {
            id:               KMSH_AWARD_CAC,
            name:             'CAC',
            minimumGradeId:   FCI_GRADE_EXCELLENT,
            minimumPlacement: 1,
            isDiscretionary:  true,
            scope:            'per-sex',
        },
        {
            // Bijlage 1 §1a: remaining dogs + 2nd-placed dog from the class
            // where CAC was awarded compete for RCAC (eventueel = not mandatory).
            id:               KMSH_AWARD_RCAC,
            name:             'RCAC',
            minimumGradeId:   FCI_GRADE_EXCELLENT,
            minimumPlacement: undefined,
            isDiscretionary:  true,
            scope:            'per-sex',
        },
    ],
    showTypes: [
        {
            id:   asShowTypeId('kmsh-national-show'),
            name: 'Nationale Tentoonstelling',
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
        },
    ],
};
