// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    asRulesetLayerId,
    asGradeScaleId,
    asGradeId,
    asSpecialOutcomeId,
    asClassId,
    asAwardTypeId,
    asShowTypeId,
} from '../../../../domain/model/effective-ruleset/value-objects/domain-ids.js';

/**
 * Named identifiers for the FCI base Ruleset Layer, shared by every FCI
 * {@link RulesetLayerEdition} module (ADR-0001 amendment: authored content
 * lives in this infrastructure adapter, one module per edition) so the
 * class/award/grade vocabulary is written once and referenced by edition
 * modules and by the KMSH national layer's cross-references.
 */

export const FCI_LAYER_ID = asRulesetLayerId('fci');
export const FCI_ADULT_GRADE_SCALE_ID = asGradeScaleId('fci-adult');

export const FCI_GRADE_EXCELLENT = asGradeId('excellent');
export const FCI_GRADE_VERY_GOOD = asGradeId('very-good');
export const FCI_GRADE_GOOD = asGradeId('good');
/** FCI Section 6 — the fourth adult grade is "Sufficient", not "Satisfactory". */
export const FCI_GRADE_SUFFICIENT = asGradeId('sufficient');

export const FCI_PUPPY_GRADE_SCALE_ID = asGradeScaleId('fci-puppy');

export const FCI_GRADE_VERY_PROMISING = asGradeId('very-promising');
export const FCI_GRADE_PROMISING = asGradeId('promising');
export const FCI_GRADE_LESS_PROMISING = asGradeId('less-promising');

export const FCI_OUTCOME_DISQUALIFIED = asSpecialOutcomeId('disqualified');
export const FCI_OUTCOME_CANNOT_BE_JUDGED = asSpecialOutcomeId('cannot-be-judged');

export const FCI_AWARD_CACIB = asAwardTypeId('cacib');
/** Reserve CACIB — Section 7. Not compulsory; no Reserve CACIB-J or CACIB-V. */
export const FCI_AWARD_RES_CACIB = asAwardTypeId('res-cacib');
export const FCI_AWARD_CACIB_J = asAwardTypeId('cacib-j');
export const FCI_AWARD_CACIB_V = asAwardTypeId('cacib-v');
export const FCI_AWARD_BOB = asAwardTypeId('bob');
export const FCI_AWARD_BOS = asAwardTypeId('bos');
export const FCI_AWARD_BIG = asAwardTypeId('big');
export const FCI_AWARD_BIS = asAwardTypeId('bis');
/** Section 7 main ring competitions — individual dog awards (non-collective). */
export const FCI_AWARD_BEST_JUNIOR = asAwardTypeId('best-junior');
export const FCI_AWARD_BEST_VETERAN = asAwardTypeId('best-veteran');
export const FCI_AWARD_BEST_PUPPY = asAwardTypeId('best-puppy');
export const FCI_AWARD_BEST_MINOR_PUPPY = asAwardTypeId('best-minor-puppy');
/** Section 7 collective competition awards — awarded to the winning group. */
export const FCI_AWARD_BEST_BRACE = asAwardTypeId('best-brace');
export const FCI_AWARD_BEST_BREEDERS_GROUP = asAwardTypeId('best-breeders-group');
export const FCI_AWARD_BEST_PROGENY_GROUP = asAwardTypeId('best-progeny-group');

// FCI class identifiers (Section 5) — named constants so edition data doesn't
// repeat magic string literals.
export const FCI_CLASS_PUPPY = asClassId('puppy');
export const FCI_CLASS_MINOR_PUPPY = asClassId('minor-puppy');
export const FCI_CLASS_JUNIOR = asClassId('junior');
export const FCI_CLASS_INTERMEDIATE = asClassId('intermediate');
export const FCI_CLASS_OPEN = asClassId('open');
export const FCI_CLASS_BRED_BY_EXHIBITOR = asClassId('bred-by-exhibitor');
export const FCI_CLASS_WORKING = asClassId('working');
export const FCI_CLASS_CHAMPION = asClassId('champion');
export const FCI_CLASS_VETERAN = asClassId('veteran');
export const FCI_CLASS_HONOUR = asClassId('honour');

export const FCI_SHOW_TYPE_CACIB_SHOW = asShowTypeId('cacib-show');
