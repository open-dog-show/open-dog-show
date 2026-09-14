// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
    GradeScale,
    Grade,
    SpecialOutcome,
} from '../../../../domain/model/effective-ruleset/entities/grade-scale.js';
import { ClassDefinition } from '../../../../domain/model/effective-ruleset/entities/class-definition.js';
import {
    PerSexAwardType,
    HigherScopeAwardType,
    CollectiveAwardType,
    AwardFeeder,
    ClassFeeder,
} from '../../../../domain/model/effective-ruleset/entities/award-type.js';
import type { AwardType } from '../../../../domain/model/effective-ruleset/entities/award-type.js';
import { ShowType } from '../../../../domain/model/effective-ruleset/entities/show-type.js';
import { asPlacement } from '../../../../domain/service/award-policy/placement.js';
import { asAgeMonths } from '../../../../domain/model/effective-ruleset/value-objects/age-months.js';
import { CERTIFICATE_KIND } from '../../../../domain/model/effective-ruleset/value-objects/certificate-kind.js';
import {
    FCI_ADULT_GRADE_SCALE_ID,
    FCI_PUPPY_GRADE_SCALE_ID,
    FCI_GRADE_EXCELLENT,
    FCI_GRADE_VERY_GOOD,
    FCI_GRADE_GOOD,
    FCI_GRADE_SUFFICIENT,
    FCI_GRADE_VERY_PROMISING,
    FCI_GRADE_PROMISING,
    FCI_GRADE_LESS_PROMISING,
    FCI_OUTCOME_DISQUALIFIED,
    FCI_OUTCOME_CANNOT_BE_JUDGED,
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
    FCI_CLASS_PUPPY,
    FCI_CLASS_MINOR_PUPPY,
    FCI_CLASS_JUNIOR,
    FCI_CLASS_INTERMEDIATE,
    FCI_CLASS_OPEN,
    FCI_CLASS_BRED_BY_EXHIBITOR,
    FCI_CLASS_WORKING,
    FCI_CLASS_CHAMPION,
    FCI_CLASS_VETERAN,
    FCI_CLASS_HONOUR,
    FCI_SHOW_TYPE_CACIB_SHOW,
} from './fci-ids.js';

/**
 * Content shared by every FCI edition authored so far (ADR-0001 amendment):
 * the grade scales, award types and show types have been stable across the
 * FCI Show Regulations revisions researched to date (`docs/research/
 * fci-international-show-rules.md`); only the class list has a documented
 * change (the Bred by Exhibitor class, added by the edition effective
 * 2027-01-01 — see `fci-2026-01-01.ts` / `fci-2027-01-01.ts`). Sharing these
 * building blocks is a deliberate DRY choice, not a loophole around "an
 * edition never changes": a genuine future rule change to a grade/award/show
 * type still requires a new edition module that stops importing from here.
 */

// ---------------------------------------------------------------------------
// Grade scales
// ---------------------------------------------------------------------------

export const fciAdultGradeScale: GradeScale = GradeScale.of({
    id: FCI_ADULT_GRADE_SCALE_ID,
    grades: [
        Grade.of(FCI_GRADE_EXCELLENT, 0),
        Grade.of(FCI_GRADE_VERY_GOOD, 1),
        Grade.of(FCI_GRADE_GOOD, 2),
        Grade.of(FCI_GRADE_SUFFICIENT, 3),
    ],
    placeableThresholdId: FCI_GRADE_VERY_GOOD,
    specialOutcomes: [
        SpecialOutcome.of(FCI_OUTCOME_DISQUALIFIED),
        SpecialOutcome.of(FCI_OUTCOME_CANNOT_BE_JUDGED),
    ],
});

/**
 * FCI Section 6 puppy/minor-puppy grade scale (Very Promising → Less Promising).
 * Used exclusively for Minor Puppy and Puppy classes.
 */
export const fciPuppyGradeScale: GradeScale = GradeScale.of({
    id: FCI_PUPPY_GRADE_SCALE_ID,
    grades: [
        Grade.of(FCI_GRADE_VERY_PROMISING, 0),
        Grade.of(FCI_GRADE_PROMISING, 1),
        Grade.of(FCI_GRADE_LESS_PROMISING, 2),
    ],
    placeableThresholdId: FCI_GRADE_VERY_PROMISING,
    specialOutcomes: [], // FCI Section 6 defines no separate special outcomes for the puppy scale
});

export const fciGradeScales: readonly GradeScale[] = [fciAdultGradeScale, fciPuppyGradeScale];

// ---------------------------------------------------------------------------
// Award types
// ---------------------------------------------------------------------------

export const fciAwardTypes: readonly AwardType[] = [
    PerSexAwardType.of({
        id: FCI_AWARD_CACIB,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: asPlacement(1),
        isDiscretionary: true,
    }),
    PerSexAwardType.of({
        // Section 7: awarded to the second-best EXCELLENT dog from the CACIB-eligible
        // classes. Not compulsory. No equivalent reserve exists for CACIB-J or CACIB-V.
        id: FCI_AWARD_RES_CACIB,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined, // selection logic lives in AwardPolicy, not here
        isDiscretionary: true,
    }),
    PerSexAwardType.of({
        id: FCI_AWARD_CACIB_J,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: asPlacement(1),
        isDiscretionary: true,
    }),
    PerSexAwardType.of({
        id: FCI_AWARD_CACIB_V,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: asPlacement(1),
        isDiscretionary: true,
    }),
    HigherScopeAwardType.breed({
        id: FCI_AWARD_BOB,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: BOB draws on the adult certificate (CACIB) winner plus the
        // junior and veteran class wins, from both sexes (sex-tagged streams).
        fedBy: [
            AwardFeeder.of(FCI_AWARD_CACIB),
            ClassFeeder.of(FCI_CLASS_JUNIOR),
            ClassFeeder.of(FCI_CLASS_VETERAN),
        ],
    }),
    HigherScopeAwardType.breed({
        id: FCI_AWARD_BOS,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: BOS shares BOB's feeders; BOS is the opposite sex to BOB.
        fedBy: [
            AwardFeeder.of(FCI_AWARD_CACIB),
            ClassFeeder.of(FCI_CLASS_JUNIOR),
            ClassFeeder.of(FCI_CLASS_VETERAN),
        ],
    }),
    HigherScopeAwardType.group({
        id: FCI_AWARD_BIG,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: BIG is fed by the BOB winners of the group's breeds.
        fedBy: [AwardFeeder.of(FCI_AWARD_BOB)],
    }),
    HigherScopeAwardType.show({
        id: FCI_AWARD_BIS,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: BIS is fed by the BIG winners.
        fedBy: [AwardFeeder.of(FCI_AWARD_BIG)],
    }),
    // -----------------------------------------------------------------------
    // Main ring competitions (Section 7) — individual dog awards.
    // Collective competitions (Brace, Breeders’ Group, Progeny Group) are
    // governed by CollectiveAwardPolicy, not AwardType. Junior Handling is
    // for handlers, not dogs.
    // -----------------------------------------------------------------------
    HigherScopeAwardType.show({
        id: FCI_AWARD_BEST_JUNIOR,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: fed by the junior class win (the class win is the feeder at
        // both CACIB and CAC shows; CACIB-J is a per-sex award, not a feeder).
        fedBy: [ClassFeeder.of(FCI_CLASS_JUNIOR)],
    }),
    HigherScopeAwardType.show({
        id: FCI_AWARD_BEST_VETERAN,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: fed by the veteran class win (CACIB-V is per-sex, not a feeder).
        fedBy: [ClassFeeder.of(FCI_CLASS_VETERAN)],
    }),
    HigherScopeAwardType.show({
        id: FCI_AWARD_BEST_PUPPY,
        minimumGradeId: FCI_GRADE_VERY_PROMISING, // Very Promising 1st from Puppy class
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: the Puppy class grants no award type; the 1st-place dog
        // proceeds directly to Best Puppy, so the feeder is the class win.
        fedBy: [ClassFeeder.of(FCI_CLASS_PUPPY)],
    }),
    HigherScopeAwardType.show({
        id: FCI_AWARD_BEST_MINOR_PUPPY,
        minimumGradeId: FCI_GRADE_VERY_PROMISING, // Very Promising 1st from Minor Puppy class
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        // ADR-0017: the Minor Puppy class grants no award type; the 1st-place
        // dog proceeds directly to Best Minor Puppy.
        fedBy: [ClassFeeder.of(FCI_CLASS_MINOR_PUPPY)],
    }),
    // -----------------------------------------------------------------------
    // Collective competition awards (Section 7) — awarded to the winning Team.
    // CollectiveAwardType has no minimumGradeId or worstEligiblePlacement — structural
    // validity is determined by CollectiveAwardPolicy, not individual dog grade.
    // -----------------------------------------------------------------------
    CollectiveAwardType.of({
        id: FCI_AWARD_BEST_BRACE,
        isDiscretionary: false,
    }),
    CollectiveAwardType.of({
        id: FCI_AWARD_BEST_BREEDERS_GROUP,
        isDiscretionary: false,
    }),
    CollectiveAwardType.of({
        id: FCI_AWARD_BEST_PROGENY_GROUP,
        isDiscretionary: false,
    }),
];

// ---------------------------------------------------------------------------
// Class definitions
// ---------------------------------------------------------------------------
//
// FCI classes in the FCI-recommended judging sequence (Section 5e: Minor
// Puppy → Puppy → Junior → Intermediate → Open → [Bred by Exhibitor, from
// the 2027-01-01 edition] → Working → Champion → Veteran; plus Honour).
//
// Age evaluation follows FCI 2026/2027 / KMSH ART.23: a dog that reaches a
// month-boundary on show day moves to the higher class.

// -----------------------------------------------------------------------
// Minor Puppy — Section 5b; compulsory; no CACIB
// Lower-age bound not stated numerically in FCI text; entry is gated by
// the Vaccination certificate ("correctly inoculated", Section 5b).
// -----------------------------------------------------------------------
export const fciMinorPuppyClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_MINOR_PUPPY,
    fromAgeMonths: undefined,
    lessThanAgeMonths: asAgeMonths(6),
    requiredCertificates: [CERTIFICATE_KIND.VaccinationCertificate],
    bredByExhibitor: false,
    gradeScaleId: FCI_PUPPY_GRADE_SCALE_ID,
    awardTypeIds: [],
});

// -----------------------------------------------------------------------
// Puppy — Section 5b; compulsory; no CACIB; uses puppy grade scale
// -----------------------------------------------------------------------
export const fciPuppyClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_PUPPY,
    fromAgeMonths: asAgeMonths(6),
    lessThanAgeMonths: asAgeMonths(9),
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: FCI_PUPPY_GRADE_SCALE_ID,
    awardTypeIds: [],
});

// -----------------------------------------------------------------------
// Junior — Section 5b; compulsory; CACIB-J
// -----------------------------------------------------------------------
export const fciJuniorClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_JUNIOR,
    fromAgeMonths: asAgeMonths(9),
    lessThanAgeMonths: asAgeMonths(18),
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB_J],
});

// -----------------------------------------------------------------------
// Intermediate — Section 5a; compulsory; CACIB
// -----------------------------------------------------------------------
export const fciIntermediateClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_INTERMEDIATE,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: asAgeMonths(24),
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
});

// -----------------------------------------------------------------------
// Open — Section 5a; compulsory; CACIB
// -----------------------------------------------------------------------
export const fciOpenClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_OPEN,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
});

// -----------------------------------------------------------------------
// Bred by Exhibitor — Section 5a; CACIB. Handler must be the breeder (or
// co-breeder) of the dog. Present only from the edition effective
// 2027-01-01 (see `fci-2027-01-01.ts`) — the edition effective 2026-01-01
// (`https://www.fci.be/medias/EXP-REG-en-20260101-22363.pdf`, corroborated
// by `docs/research/belgium-srsh-show-rules.md`) lists Intermediate, Open,
// Working and Champion as the CACIB-eligible classes and does not mention
// Bred by Exhibitor at all; it was added by the consolidated FCI Show
// Regulations effective 1 Jan 2027 (May 2025 Budapest amendments —
// `docs/research/fci-international-show-rules.md`).
// -----------------------------------------------------------------------
export const fciBredByExhibitorClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_BRED_BY_EXHIBITOR,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: true,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
});

// -----------------------------------------------------------------------
// Working — Section 5a; compulsory; CACIB; working breeds only
// -----------------------------------------------------------------------
export const fciWorkingClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_WORKING,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: undefined,
    requiredCertificates: [CERTIFICATE_KIND.WorkingCertificate],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
});

// -----------------------------------------------------------------------
// Champion — Section 5a; compulsory; CACIB; requires champion title
// -----------------------------------------------------------------------
export const fciChampionClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_CHAMPION,
    fromAgeMonths: asAgeMonths(15),
    lessThanAgeMonths: undefined,
    requiredCertificates: [CERTIFICATE_KIND.ChampionCertificate],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB, FCI_AWARD_RES_CACIB],
});

// -----------------------------------------------------------------------
// Veteran — Section 5b; compulsory; CACIB-V; 8 years = 96 months
// -----------------------------------------------------------------------
export const fciVeteranClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_VETERAN,
    fromAgeMonths: asAgeMonths(96),
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [FCI_AWARD_CACIB_V],
});

// -----------------------------------------------------------------------
// Honour — no CACIB. Not listed in FCI CACIB Section 5; likely a
// national-level class included for completeness.
// -----------------------------------------------------------------------
export const fciHonourClass: ClassDefinition = ClassDefinition.of({
    id: FCI_CLASS_HONOUR,
    fromAgeMonths: undefined,
    lessThanAgeMonths: undefined,
    requiredCertificates: [],
    bredByExhibitor: false,
    gradeScaleId: FCI_ADULT_GRADE_SCALE_ID,
    awardTypeIds: [],
});

// ---------------------------------------------------------------------------
// Show types
// ---------------------------------------------------------------------------

export const fciShowTypes: readonly ShowType[] = [
    ShowType.of({
        id: FCI_SHOW_TYPE_CACIB_SHOW,
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
    }),
];
