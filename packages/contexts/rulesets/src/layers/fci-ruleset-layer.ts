// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayer } from '../domain/ruleset-layer.js';
import type { GradeScale } from '../domain/grade-scale.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { AwardType } from '../domain/award-type.js';
import type { ShowType } from '../domain/show-type.js';
import {
    asRulesetLayerId,
    asGradeScaleId,
    asGradeId,
    asSpecialOutcomeId,
    asClassId,
    asAwardTypeId,
    asShowTypeId,
} from '../domain/domain-ids.js';
import { CertificateKind } from '../domain/certificate-kind.js';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export const FCI_LAYER_ID = asRulesetLayerId('fci');
export const FCI_GRADE_SCALE_ID = asGradeScaleId('fci-adult');

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

// ---------------------------------------------------------------------------
// Grade scale
// ---------------------------------------------------------------------------

const fciAdultGradeScale: GradeScale = {
    id: FCI_GRADE_SCALE_ID,
    grades: [
        { id: FCI_GRADE_EXCELLENT, ordinal: 0 },
        { id: FCI_GRADE_VERY_GOOD, ordinal: 1 },
        { id: FCI_GRADE_GOOD, ordinal: 2 },
        { id: FCI_GRADE_SUFFICIENT, ordinal: 3 },
    ],
    placeableThresholdId: FCI_GRADE_VERY_GOOD,
    specialOutcomes: [{ id: FCI_OUTCOME_DISQUALIFIED }, { id: FCI_OUTCOME_CANNOT_BE_JUDGED }],
};

/**
 * FCI Section 6 puppy/minor-puppy grade scale (Very Promising → Less Promising).
 * Used exclusively for Minor Puppy and Puppy classes.
 */
const fciPuppyGradeScale: GradeScale = {
    id: FCI_PUPPY_GRADE_SCALE_ID,
    grades: [
        { id: FCI_GRADE_VERY_PROMISING, ordinal: 0 },
        { id: FCI_GRADE_PROMISING, ordinal: 1 },
        { id: FCI_GRADE_LESS_PROMISING, ordinal: 2 },
    ],
    placeableThresholdId: FCI_GRADE_VERY_PROMISING,
    specialOutcomes: [], // FCI Section 6 defines no separate special outcomes for the puppy scale
};

// ---------------------------------------------------------------------------
// Award types
// ---------------------------------------------------------------------------

const fciAwardTypes: ReadonlyArray<AwardType> = [
    {
        id: FCI_AWARD_CACIB,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: 1,
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        // Section 7: awarded to the second-best EXCELLENT dog from the CACIB-eligible
        // classes. Not compulsory. No equivalent reserve exists for CACIB-J or CACIB-V.
        id: FCI_AWARD_RES_CACIB,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: undefined, // selection logic lives in AwardPolicy, not here
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        id: FCI_AWARD_CACIB_J,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: 1,
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        id: FCI_AWARD_CACIB_V,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: 1,
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        id: FCI_AWARD_BOB,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'breed',
    },
    {
        id: FCI_AWARD_BOS,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'breed',
    },
    {
        id: FCI_AWARD_BIG,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'group',
    },
    {
        id: FCI_AWARD_BIS,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'show',
    },
    // -----------------------------------------------------------------------
    // Main ring competitions (Section 7) — individual dog awards.
    // Collective competitions (Brace, Breeders’ Group, Progeny Group) are
    // governed by CollectiveAwardPolicy, not AwardType. Junior Handling is
    // for handlers, not dogs.
    // -----------------------------------------------------------------------
    {
        id: FCI_AWARD_BEST_JUNIOR,
        minimumGradeId: FCI_GRADE_EXCELLENT, // from CACIB-J winners
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'show',
    },
    {
        id: FCI_AWARD_BEST_VETERAN,
        minimumGradeId: FCI_GRADE_EXCELLENT, // from CACIB-V winners
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'show',
    },
    {
        id: FCI_AWARD_BEST_PUPPY,
        minimumGradeId: FCI_GRADE_VERY_PROMISING, // Very Promising 1st from Puppy class
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'show',
    },
    {
        id: FCI_AWARD_BEST_MINOR_PUPPY,
        minimumGradeId: FCI_GRADE_VERY_PROMISING, // Very Promising 1st from Minor Puppy class
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'show',
    },
    // -----------------------------------------------------------------------
    // Collective competition awards (Section 7) — awarded to the winning group.
    // CollectiveAwardType has no minimumGradeId or minimumPlacement — structural
    // validity is determined by CollectiveAwardPolicy, not individual dog grade.
    // -----------------------------------------------------------------------
    {
        id: FCI_AWARD_BEST_BRACE,
        isDiscretionary: false,
        scope: 'collective',
    },
    {
        id: FCI_AWARD_BEST_BREEDERS_GROUP,
        isDiscretionary: false,
        scope: 'collective',
    },
    {
        id: FCI_AWARD_BEST_PROGENY_GROUP,
        isDiscretionary: false,
        scope: 'collective',
    },
];

// ---------------------------------------------------------------------------
// Class definitions
// ---------------------------------------------------------------------------

/**
 * Ten FCI classes in the FCI-recommended judging sequence
 * (Section 5e: Minor Puppy → Puppy → Junior → Intermediate → Open →
 * Bred by Exhibitor → Working → Champion → Veteran; plus Honour).
 *
 * Age evaluation follows FCI 2026 / KMSH ART.23: a dog that reaches a
 * month-boundary on show day moves to the higher class.
 */
const fciClassDefinitions: ReadonlyArray<ClassDefinition> = [
    // -----------------------------------------------------------------------
    // Minor Puppy — Section 5b; compulsory; no CACIB
    // Lower-age bound not stated numerically in FCI text; entry is gated by
    // the Vaccination certificate ("correctly inoculated", Section 5b).
    // -----------------------------------------------------------------------
    {
        id: asClassId('minor-puppy'),
        fromAgeMonths: undefined,
        lessThanAgeMonths: 6,
        requiredCertificates: [CertificateKind.Vaccination],
        bredByExhibitor: false,
        gradeScaleId: FCI_PUPPY_GRADE_SCALE_ID,
        awardTypeIds: [],
    },
    // -----------------------------------------------------------------------
    // Puppy — Section 5b; compulsory; no CACIB; uses puppy grade scale
    // -----------------------------------------------------------------------
    {
        id: asClassId('puppy'),
        fromAgeMonths: 6,
        lessThanAgeMonths: 9,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: FCI_PUPPY_GRADE_SCALE_ID,
        awardTypeIds: [],
    },
    // -----------------------------------------------------------------------
    // Junior — Section 5b; compulsory; CACIB-J
    // -----------------------------------------------------------------------
    {
        id: asClassId('junior'),
        fromAgeMonths: 9,
        lessThanAgeMonths: 18,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB_J],
    },
    // -----------------------------------------------------------------------
    // Intermediate — Section 5a; compulsory; CACIB
    // -----------------------------------------------------------------------
    {
        id: asClassId('intermediate'),
        fromAgeMonths: 15,
        lessThanAgeMonths: 24,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
    },
    // -----------------------------------------------------------------------
    // Open — Section 5a; compulsory; CACIB
    // -----------------------------------------------------------------------
    {
        id: asClassId('open'),
        fromAgeMonths: 15,
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
    },
    // -----------------------------------------------------------------------
    // Bred by Exhibitor — Section 5a; compulsory from 2027-01-01; CACIB.
    // Handler must be the breeder (or co-breeder) of the dog.
    // -----------------------------------------------------------------------
    {
        id: asClassId('bred-by-exhibitor'),
        fromAgeMonths: 15,
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: true,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
    },
    // -----------------------------------------------------------------------
    // Working — Section 5a; compulsory; CACIB; working breeds only
    // -----------------------------------------------------------------------
    {
        id: asClassId('working'),
        fromAgeMonths: 15,
        lessThanAgeMonths: undefined,
        requiredCertificates: [CertificateKind.WorkingCertificate],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
    },
    // -----------------------------------------------------------------------
    // Champion — Section 5a; compulsory; CACIB; requires champion title
    // -----------------------------------------------------------------------
    {
        id: asClassId('champion'),
        fromAgeMonths: 15,
        lessThanAgeMonths: undefined,
        requiredCertificates: [CertificateKind.ChampionCertificate],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
    },
    // -----------------------------------------------------------------------
    // Veteran — Section 5b; compulsory; CACIB-V; 8 years = 96 months
    // -----------------------------------------------------------------------
    {
        id: asClassId('veteran'),
        fromAgeMonths: 96,
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [FCI_AWARD_CACIB_V],
    },
    // -----------------------------------------------------------------------
    // Honour — included per issue spec; no CACIB.
    // Not listed in FCI CACIB Section 5; may be a national-level class.
    // See docs/research/fci-ruleset.md D6 for context.
    // -----------------------------------------------------------------------
    {
        id: asClassId('honour'),
        fromAgeMonths: undefined,
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: FCI_GRADE_SCALE_ID,
        awardTypeIds: [],
    },
];

// ---------------------------------------------------------------------------
// Show types
// ---------------------------------------------------------------------------

const fciShowTypes: ReadonlyArray<ShowType> = [
    {
        id: asShowTypeId('cacib-show'),
        availableAwardTypeIds: [
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
];

// ---------------------------------------------------------------------------
// FCI base RulesetLayer
// ---------------------------------------------------------------------------

/**
 * The FCI base {@link RulesetLayer}.
 *
 * Contains two grade scales (FCI Adult: Excellent → Sufficient; FCI Puppy:
 * Very Promising → Less Promising), ten class definitions ordered per FCI
 * Section 5e judging sequence, fifteen award types (CACIB, Res-CACIB,
 * CACIB-J, CACIB-V, BOB, BOS, BIG, BIS; Best Junior/Veteran/Puppy/Minor
 * Puppy in Show; Best Brace/Breeders' Group/Progeny Group), and a
 * CAC-CACIB show type.
 *
 * Compose with a national override layer (e.g. {@link kmshLayer} from
 * `kmsh-ruleset-layer.ts`) to obtain a national show's Effective Ruleset.
 */
export const fciLayer: RulesetLayer = {
    id: FCI_LAYER_ID,
    parentLayerId: undefined,
    classDefinitions: fciClassDefinitions,
    gradeScales: [fciAdultGradeScale, fciPuppyGradeScale],
    awardTypes: fciAwardTypes,
    showTypes: fciShowTypes,
};
