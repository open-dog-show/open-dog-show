// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asRulesetLayerId,
    asClassId,
    asAwardTypeId,
    asShowTypeId,
} from '../../../../domain/shared/domain-ids.js';

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
export const KMSH_AWARD_RCAC = asAwardTypeId('res-cac');

/**
 * Fokkersklas / Classe des éleveurs — KMSH national class available at
 * breed-specific shows (ART.24). Handler must be the breeder of the dog
 * (bredByExhibitor). Eligible for CAC and RCAC.
 */
export const KMSH_CLASS_FOKKERSKLAS = asClassId('fokkersklas');

export const KMSH_SHOW_TYPE_NATIONAL_SHOW = asShowTypeId('kmsh-national-show');
