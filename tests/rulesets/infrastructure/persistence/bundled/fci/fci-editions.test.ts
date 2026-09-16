// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    fci20260101,
    fci20270101,
    FCI_LAYER_ID,
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
    FCI_CLASS_BRED_BY_EXHIBITOR,
    FCI_CLASS_MINOR_PUPPY,
    FCI_CLASS_PUPPY,
    FCI_CLASS_JUNIOR,
    FCI_CLASS_INTERMEDIATE,
    FCI_CLASS_OPEN,
    FCI_CLASS_VETERAN,
    FCI_CLASS_HONOUR,
} from '../../../../../../src/rulesets/infrastructure/persistence/bundled/fci/index.js';
import { asClassId } from '../../../../../../src/rulesets/domain/shared/domain-ids.js';
import { LocalDate } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import { CERTIFICATE_KIND } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/certificate-kind.js';
import { findOrFail } from '../../../../../test-kit/index.js';
import type {
    IndividualAwardType,
    HigherScopeAwardType,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import type { AwardTypeId } from '../../../../../../src/rulesets/domain/shared/domain-ids.js';
import type { RulesetLayerEdition } from '../../../../../../src/rulesets/domain/model/ruleset-layer-edition/ruleset-layer-edition.js';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('fci20260101 / fci20270101 — metadata', () => {
    it('both editions carry the FCI layer id', () => {
        expect(fci20260101.layerId).toBe(FCI_LAYER_ID);
        expect(fci20270101.layerId).toBe(FCI_LAYER_ID);
    });

    it('effectiveFrom matches the edition module name', () => {
        expect(fci20260101.effectiveFrom).toEqual(LocalDate.of(2026, 1, 1));
        expect(fci20270101.effectiveFrom).toEqual(LocalDate.of(2027, 1, 1));
    });
});

// ---------------------------------------------------------------------------
// Grade scales — shared by both editions
// ---------------------------------------------------------------------------

describe.each([
    ['fci20260101', fci20260101],
    ['fci20270101', fci20270101],
])('%s — grade scales', (_name, edition: RulesetLayerEdition) => {
    it('has exactly two grade scales (adult and puppy)', () => {
        expect(edition.gradeScales).toHaveLength(2);
    });

    describe('adult grade scale', () => {
        const adultScale = () =>
            findOrFail(
                edition.gradeScales.find((s) => s.id !== FCI_PUPPY_GRADE_SCALE_ID),
                'adult grade scale',
            );

        it('has four grades in ordinal order', () => {
            expect(adultScale().grades).toHaveLength(4);
            expect(adultScale().grades.map((g) => g.ordinal)).toEqual([0, 1, 2, 3]);
        });

        it('grade ids are excellent, very-good, good, sufficient (FCI Section 6)', () => {
            const ids = adultScale().grades.map((g) => g.id);
            expect(ids).toEqual([
                FCI_GRADE_EXCELLENT,
                FCI_GRADE_VERY_GOOD,
                FCI_GRADE_GOOD,
                FCI_GRADE_SUFFICIENT,
            ]);
        });

        it('placeable threshold is Very Good (ordinal 1)', () => {
            const scale = adultScale();
            const threshold = scale.grades.find((g) => g.id === scale.placeableThresholdId);
            expect(threshold?.ordinal).toBe(1);
            expect(threshold?.id).toBe(FCI_GRADE_VERY_GOOD);
        });

        it('has two special outcomes: Disqualified and Cannot Be Judged', () => {
            expect(adultScale().specialOutcomes).toHaveLength(2);
            const ids = adultScale().specialOutcomes.map((o) => o.id);
            expect(ids).toContain(FCI_OUTCOME_DISQUALIFIED);
            expect(ids).toContain(FCI_OUTCOME_CANNOT_BE_JUDGED);
        });
    });

    describe('puppy grade scale', () => {
        const puppyScale = () =>
            findOrFail(
                edition.gradeScales.find((s) => s.id === FCI_PUPPY_GRADE_SCALE_ID),
                'puppy grade scale',
            );

        it('has three grades: Very Promising, Promising, Less Promising', () => {
            const ids = puppyScale().grades.map((g) => g.id);
            expect(ids).toEqual([
                FCI_GRADE_VERY_PROMISING,
                FCI_GRADE_PROMISING,
                FCI_GRADE_LESS_PROMISING,
            ]);
        });

        it('placeable threshold is Very Promising (ordinal 0)', () => {
            const scale = puppyScale();
            const threshold = scale.grades.find((g) => g.id === scale.placeableThresholdId);
            expect(threshold?.ordinal).toBe(0);
        });

        it('has no special outcomes', () => {
            expect(puppyScale().specialOutcomes).toHaveLength(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Class definitions — the documented rule change (ADR-0029, issue #191)
// ---------------------------------------------------------------------------

describe('fci20260101 — class definitions', () => {
    it('has exactly nine class definitions (no Bred by Exhibitor)', () => {
        expect(fci20260101.classDefinitions).toHaveLength(9);
    });

    it('does not include Bred by Exhibitor', () => {
        expect(
            fci20260101.classDefinitions.find((c) => c.id === FCI_CLASS_BRED_BY_EXHIBITOR),
        ).toBeUndefined();
    });
});

describe('fci20270101 — class definitions', () => {
    it('has exactly ten class definitions', () => {
        expect(fci20270101.classDefinitions).toHaveLength(10);
    });

    it('Bred by Exhibitor class is 15+ months with bredByExhibitor=true and feeds CACIB', () => {
        const cls = findOrFail(
            fci20270101.classDefinitions.find((c) => c.id === FCI_CLASS_BRED_BY_EXHIBITOR),
            'bred-by-exhibitor',
        );
        expect(cls.fromAgeMonths).toBe(15);
        expect(cls.lessThanAgeMonths).toBeUndefined();
        expect(cls.bredByExhibitor).toBe(true);
        expect(cls.awardTypeIds).toContain(FCI_AWARD_CACIB);
    });
});

describe.each([
    ['fci20260101', fci20260101],
    ['fci20270101', fci20270101],
])('%s — class definitions shared by both editions', (_name, edition: RulesetLayerEdition) => {
    it('Minor Puppy class is under 6 months, requires vaccination, uses puppy scale', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_MINOR_PUPPY),
            'minor-puppy',
        );
        expect(cls.fromAgeMonths).toBeUndefined();
        expect(cls.lessThanAgeMonths).toBe(6);
        expect(cls.requiredCertificates).toContain(CERTIFICATE_KIND.VaccinationCertificate);
        expect(cls.gradeScaleId).toBe(FCI_PUPPY_GRADE_SCALE_ID);
        expect(cls.awardTypeIds).toHaveLength(0);
    });

    it('Puppy class is 6–9 months with no required certificates and uses puppy scale', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_PUPPY),
            'puppy',
        );
        expect(cls.fromAgeMonths).toBe(6);
        expect(cls.lessThanAgeMonths).toBe(9);
        expect(cls.requiredCertificates).toEqual([]);
        expect(cls.gradeScaleId).toBe(FCI_PUPPY_GRADE_SCALE_ID);
    });

    it('Junior class is 9–18 months and feeds CACIB-J', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_JUNIOR),
            'junior',
        );
        expect(cls.fromAgeMonths).toBe(9);
        expect(cls.lessThanAgeMonths).toBe(18);
        expect(cls.awardTypeIds).toContain(FCI_AWARD_CACIB_J);
    });

    it('Intermediate class is 15–24 months and feeds CACIB', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_INTERMEDIATE),
            'intermediate',
        );
        expect(cls.fromAgeMonths).toBe(15);
        expect(cls.lessThanAgeMonths).toBe(24);
        expect(cls.awardTypeIds).toContain(FCI_AWARD_CACIB);
    });

    it('Open class is 15+ months with no upper bound and feeds CACIB', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_OPEN),
            'open',
        );
        expect(cls.fromAgeMonths).toBe(15);
        expect(cls.lessThanAgeMonths).toBeUndefined();
        expect(cls.awardTypeIds).toContain(FCI_AWARD_CACIB);
    });

    it('Veteran class starts at 96 months (8 years) with no upper bound', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_VETERAN),
            'veteran',
        );
        expect(cls.fromAgeMonths).toBe(96);
        expect(cls.lessThanAgeMonths).toBeUndefined();
        expect(cls.awardTypeIds).toContain(FCI_AWARD_CACIB_V);
    });

    it('Honour class has no age restriction', () => {
        const cls = findOrFail(
            edition.classDefinitions.find((c) => c.id === FCI_CLASS_HONOUR),
            'honour',
        );
        expect(cls.fromAgeMonths).toBeUndefined();
        expect(cls.lessThanAgeMonths).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Award types — shared by both editions
// ---------------------------------------------------------------------------

describe.each([
    ['fci20260101', fci20260101],
    ['fci20270101', fci20270101],
])('%s — award types', (_name, edition: RulesetLayerEdition) => {
    it('has exactly fifteen award types', () => {
        expect(edition.awardTypes).toHaveLength(15);
    });

    it('CACIB is per-sex, discretionary, Excellent-1st', () => {
        const at = findOrFail(
            edition.awardTypes.find(
                (a): a is IndividualAwardType =>
                    a.id === FCI_AWARD_CACIB && a.scope !== 'collective',
            ),
            `award type '${FCI_AWARD_CACIB}'`,
        );
        expect(at.scope).toBe('per-sex');
        expect(at.isDiscretionary).toBe(true);
        expect(at.worstEligiblePlacement).toBe(1);
    });

    it('Reserve CACIB is per-sex, discretionary, no placement requirement', () => {
        const at = findOrFail(
            edition.awardTypes.find(
                (a): a is IndividualAwardType =>
                    a.id === FCI_AWARD_RES_CACIB && a.scope !== 'collective',
            ),
            `award type '${FCI_AWARD_RES_CACIB}'`,
        );
        expect(at.worstEligiblePlacement).toBeUndefined();
    });

    it('BOB is breed scope, BIG is group scope, BIS is show scope', () => {
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BOB)?.scope).toBe('breed');
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BOS)?.scope).toBe('breed');
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BIG)?.scope).toBe('group');
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BIS)?.scope).toBe('show');
    });

    it('Best Puppy / Best Minor Puppy require Very Promising, not Excellent', () => {
        const bestPuppy = findOrFail(
            edition.awardTypes.find(
                (a): a is IndividualAwardType =>
                    a.id === FCI_AWARD_BEST_PUPPY && a.scope !== 'collective',
            ),
            `award type '${FCI_AWARD_BEST_PUPPY}'`,
        );
        const bestMinorPuppy = findOrFail(
            edition.awardTypes.find(
                (a): a is IndividualAwardType =>
                    a.id === FCI_AWARD_BEST_MINOR_PUPPY && a.scope !== 'collective',
            ),
            `award type '${FCI_AWARD_BEST_MINOR_PUPPY}'`,
        );
        expect(bestPuppy.minimumGradeId).toBe(FCI_GRADE_VERY_PROMISING);
        expect(bestMinorPuppy.minimumGradeId).toBe(FCI_GRADE_VERY_PROMISING);
    });

    it('Best Brace / Breeders’ Group / Progeny Group are collective scope', () => {
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BEST_BRACE)?.scope).toBe(
            'collective',
        );
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BEST_BREEDERS_GROUP)?.scope).toBe(
            'collective',
        );
        expect(edition.awardTypes.find((a) => a.id === FCI_AWARD_BEST_PROGENY_GROUP)?.scope).toBe(
            'collective',
        );
    });
});

// ---------------------------------------------------------------------------
// fedBy declarations (ADR-0017) — shared by both editions
// ---------------------------------------------------------------------------

describe.each([
    ['fci20260101', fci20260101],
    ['fci20270101', fci20270101],
])('%s — fedBy declarations (ADR-0017)', (_name, edition: RulesetLayerEdition) => {
    const individual = (id: AwardTypeId): HigherScopeAwardType => {
        const at = edition.awardTypes.find((a) => a.id === id);
        if (at === undefined || at.scope === 'per-sex' || at.scope === 'collective') {
            throw new Error(`higher-scope award type ${id} not found`);
        }
        return at;
    };

    it('BOB and BOS are fed by CACIB + junior + veteran class wins', () => {
        const expected = [
            { kind: 'award', awardTypeId: FCI_AWARD_CACIB },
            { kind: 'class', classId: asClassId('junior') },
            { kind: 'class', classId: asClassId('veteran') },
        ];
        expect(individual(FCI_AWARD_BOB).fedBy).toEqual(expected);
        expect(individual(FCI_AWARD_BOS).fedBy).toEqual(expected);
    });

    it('BIG is fed by BOB winners; BIS is fed by BIG winners', () => {
        expect(individual(FCI_AWARD_BIG).fedBy).toEqual([
            { kind: 'award', awardTypeId: FCI_AWARD_BOB },
        ]);
        expect(individual(FCI_AWARD_BIS).fedBy).toEqual([
            { kind: 'award', awardTypeId: FCI_AWARD_BIG },
        ]);
    });

    it('Best Junior/Veteran/Puppy/Minor Puppy are fed by their class win, not the per-sex award', () => {
        expect(individual(FCI_AWARD_BEST_JUNIOR).fedBy).toEqual([
            { kind: 'class', classId: asClassId('junior') },
        ]);
        expect(individual(FCI_AWARD_BEST_VETERAN).fedBy).toEqual([
            { kind: 'class', classId: asClassId('veteran') },
        ]);
        expect(individual(FCI_AWARD_BEST_PUPPY).fedBy).toEqual([
            { kind: 'class', classId: asClassId('puppy') },
        ]);
        expect(individual(FCI_AWARD_BEST_MINOR_PUPPY).fedBy).toEqual([
            { kind: 'class', classId: asClassId('minor-puppy') },
        ]);
    });
});
