// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    fciLayer,
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
} from '../layers/fci-ruleset-layer.js';
import {
    kmshLayer,
    KMSH_LAYER_ID,
    KMSH_AWARD_CAC,
    KMSH_AWARD_RCAC,
    KMSH_CLASS_FOKKERSKLAS,
} from '../layers/kmsh-ruleset-layer.js';
import { resolveEffectiveRuleset } from '../domain/resolve-effective-ruleset.js';
import { CertificateKind } from '../domain/certificate-kind.js';
import { asClassId } from '../domain/domain-ids.js';
import type { AwardTypeId } from '../domain/domain-ids.js';
import type { LocalDate } from '../domain/local-date.js';
import type { IndividualAwardType } from '../domain/award-type.js';
import type { EffectiveRuleset } from '../domain/effective-ruleset.js';

const RESOLVE_DATE: LocalDate = { year: 2026, month: 8, day: 11 };

// ---------------------------------------------------------------------------
// FCI base layer — structure
// ---------------------------------------------------------------------------

describe('fciLayer — grade scales', () => {
    it('has exactly two grade scales (adult and puppy)', () => {
        expect(fciLayer.gradeScales).toHaveLength(2);
    });

    describe('adult grade scale', () => {
        const adultScale = () =>
            fciLayer.gradeScales.find((s) => s.id !== FCI_PUPPY_GRADE_SCALE_ID)!;

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
            fciLayer.gradeScales.find((s) => s.id === FCI_PUPPY_GRADE_SCALE_ID)!;

        it('exists with id fci-puppy', () => {
            expect(puppyScale()).toBeDefined();
        });

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

describe('fciLayer — class definitions', () => {
    it('has exactly ten class definitions', () => {
        expect(fciLayer.classDefinitions).toHaveLength(10);
    });

    it('Minor Puppy class is under 6 months, requires vaccination, uses puppy scale', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'minor-puppy');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBeUndefined();
        expect(cls!.lessThanAgeMonths).toBe(6);
        expect(cls!.requiredCertificates).toContain(CertificateKind.Vaccination);
        expect(cls!.gradeScaleId).toBe(FCI_PUPPY_GRADE_SCALE_ID);
        expect(cls!.awardTypeIds).toHaveLength(0);
    });

    it('Puppy class is 6–9 months with no required certificates and uses puppy scale', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'puppy');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(6);
        expect(cls!.lessThanAgeMonths).toBe(9);
        expect(cls!.requiredCertificates).toEqual([]);
        expect(cls!.gradeScaleId).toBe(FCI_PUPPY_GRADE_SCALE_ID);
    });

    it('Junior class is 9–18 months and feeds CACIB-J', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'junior');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(9);
        expect(cls!.lessThanAgeMonths).toBe(18);
        expect(cls!.awardTypeIds).toContain('cacib-j');
    });

    it('Intermediate class is 15–24 months and feeds CACIB', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'intermediate');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(15);
        expect(cls!.lessThanAgeMonths).toBe(24);
        expect(cls!.awardTypeIds).toContain('cacib');
    });

    it('Open class is 15+ months with no upper bound and feeds CACIB', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'open');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(15);
        expect(cls!.lessThanAgeMonths).toBeUndefined();
        expect(cls!.awardTypeIds).toContain('cacib');
    });

    it('Working class is 15+ months and requires working certificate', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'working');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(15);
        expect(cls!.requiredCertificates).toContain(CertificateKind.WorkingCertificate);
    });

    it('Champion class is 15+ months and requires champion certificate', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'champion');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(15);
        expect(cls!.requiredCertificates).toContain(CertificateKind.ChampionCertificate);
    });

    it('Veteran class starts at 96 months (8 years) with no upper bound', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'veteran');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(96);
        expect(cls!.lessThanAgeMonths).toBeUndefined();
        expect(cls!.awardTypeIds).toContain('cacib-v');
    });

    it('Bred by Exhibitor class is 15+ months with bredByExhibitor=true and feeds CACIB', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'bred-by-exhibitor');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(15);
        expect(cls!.lessThanAgeMonths).toBeUndefined();
        expect(cls!.bredByExhibitor).toBe(true);
        expect(cls!.awardTypeIds).toContain('cacib');
    });

    it('Honour class has no age restriction', () => {
        const cls = fciLayer.classDefinitions.find((c) => c.id === 'honour');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBeUndefined();
        expect(cls!.lessThanAgeMonths).toBeUndefined();
    });
});

describe('fciLayer — award types', () => {
    it('has exactly fifteen award types', () => {
        expect(fciLayer.awardTypes).toHaveLength(15);
    });

    it('CACIB is per-sex, discretionary, Excellent-1st', () => {
        const at = fciLayer.awardTypes.find(
            (a): a is IndividualAwardType => a.id === FCI_AWARD_CACIB && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBe(1);
        // minimumGradeId must be the Excellent grade on the FCI adult scale
        const excellent = fciLayer.gradeScales[0]!.grades.find((g) => g.ordinal === 0);
        expect(at!.minimumGradeId).toBe(excellent!.id);
    });

    it('Reserve CACIB is per-sex, discretionary, Excellent, no placement requirement', () => {
        const at = fciLayer.awardTypes.find(
            (a): a is IndividualAwardType =>
                a.id === FCI_AWARD_RES_CACIB && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBeUndefined();
    });

    it('CACIB-J is per-sex, discretionary, Excellent-1st', () => {
        const at = fciLayer.awardTypes.find(
            (a): a is IndividualAwardType => a.id === FCI_AWARD_CACIB_J && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBe(1);
    });

    it('CACIB-V is per-sex, discretionary, Excellent-1st', () => {
        const at = fciLayer.awardTypes.find(
            (a): a is IndividualAwardType => a.id === FCI_AWARD_CACIB_V && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBe(1);
    });

    it('BOB is breed scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BOB);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('breed');
    });

    it('BOS is breed scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BOS);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('breed');
    });

    it('BIG is group scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BIG);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('group');
    });

    it('BIS is show scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BIS);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
    });

    it('Best Junior in Show is show scope, not discretionary, Excellent', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BEST_JUNIOR);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
    });

    it('Best Veteran in Show is show scope, not discretionary, Excellent', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BEST_VETERAN);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
    });

    it('Best Puppy in Show is show scope, not discretionary, Very Promising', () => {
        const at = fciLayer.awardTypes.find(
            (a): a is IndividualAwardType =>
                a.id === FCI_AWARD_BEST_PUPPY && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
        expect(at!.minimumGradeId).toBe('very-promising');
    });

    it('Best Minor Puppy in Show is show scope, not discretionary, Very Promising', () => {
        const at = fciLayer.awardTypes.find(
            (a): a is IndividualAwardType =>
                a.id === FCI_AWARD_BEST_MINOR_PUPPY && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
        expect(at!.minimumGradeId).toBe('very-promising');
    });

    it('Best Brace is collective scope, not discretionary, no minimum grade', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BEST_BRACE);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('collective');
        expect(at!.isDiscretionary).toBe(false);
        expect('minimumGradeId' in at!).toBe(false);
    });

    it('Best Breeders\u2019 Group is collective scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BEST_BREEDERS_GROUP);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('collective');
    });

    it('Best Progeny Group is collective scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === FCI_AWARD_BEST_PROGENY_GROUP);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('collective');
    });
});

describe('fciLayer — metadata', () => {
    it('has the expected FCI layer ID', () => {
        expect(fciLayer.id).toBe(FCI_LAYER_ID);
    });

    it('has no parent layer (base layer)', () => {
        expect(fciLayer.parentLayerId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// fciLayer — fedBy declarations (ADR-0017)
// ---------------------------------------------------------------------------

describe('fciLayer — fedBy declarations (ADR-0017)', () => {
    const individual = (id: AwardTypeId): IndividualAwardType => {
        const at = fciLayer.awardTypes.find((a) => a.id === id);
        if (!at || at.scope === 'collective') {
            throw new Error(`individual award type ${id} not found`);
        }
        return at;
    };

    it('BOB is fed by CACIB + junior + veteran class wins', () => {
        expect(individual(FCI_AWARD_BOB).fedBy).toEqual([
            { awardTypeId: FCI_AWARD_CACIB },
            { classId: asClassId('junior') },
            { classId: asClassId('veteran') },
        ]);
    });

    it('BOS is fed by CACIB + junior + veteran class wins (same feeders as BOB)', () => {
        expect(individual(FCI_AWARD_BOS).fedBy).toEqual([
            { awardTypeId: FCI_AWARD_CACIB },
            { classId: asClassId('junior') },
            { classId: asClassId('veteran') },
        ]);
    });

    it('BIG is fed by BOB winners', () => {
        expect(individual(FCI_AWARD_BIG).fedBy).toEqual([{ awardTypeId: FCI_AWARD_BOB }]);
    });

    it('BIS is fed by BIG winners', () => {
        expect(individual(FCI_AWARD_BIS).fedBy).toEqual([{ awardTypeId: FCI_AWARD_BIG }]);
    });

    it('Best Junior is fed by the junior class win (not CACIB-J)', () => {
        expect(individual(FCI_AWARD_BEST_JUNIOR).fedBy).toEqual([{ classId: asClassId('junior') }]);
    });

    it('Best Veteran is fed by the veteran class win (not CACIB-V)', () => {
        expect(individual(FCI_AWARD_BEST_VETERAN).fedBy).toEqual([
            { classId: asClassId('veteran') },
        ]);
    });

    it('Best Puppy is fed by the puppy class win', () => {
        expect(individual(FCI_AWARD_BEST_PUPPY).fedBy).toEqual([{ classId: asClassId('puppy') }]);
    });

    it('Best Minor Puppy is fed by the minor-puppy class win', () => {
        expect(individual(FCI_AWARD_BEST_MINOR_PUPPY).fedBy).toEqual([
            { classId: asClassId('minor-puppy') },
        ]);
    });

    it('CACIB-J is NOT listed as a feeder on any award', () => {
        for (const at of fciLayer.awardTypes) {
            if (at.scope === 'collective') continue;
            const fedBy = (at as IndividualAwardType).fedBy;
            if (!fedBy) continue;
            expect(fedBy).not.toContainEqual({ awardTypeId: FCI_AWARD_CACIB_J });
        }
    });

    it('CACIB-V is NOT listed as a feeder on any award', () => {
        for (const at of fciLayer.awardTypes) {
            if (at.scope === 'collective') continue;
            const fedBy = (at as IndividualAwardType).fedBy;
            if (!fedBy) continue;
            expect(fedBy).not.toContainEqual({ awardTypeId: FCI_AWARD_CACIB_V });
        }
    });

    it('per-sex award types have no fedBy (feeders are breed/group/show only)', () => {
        for (const at of fciLayer.awardTypes) {
            if (at.scope === 'per-sex') {
                expect((at as IndividualAwardType).fedBy).toBeUndefined();
            }
        }
    });
});

// ---------------------------------------------------------------------------
// resolveEffectiveRuleset([fciLayer], date) — FCI-only snapshot
// ---------------------------------------------------------------------------

describe('resolveEffectiveRuleset with FCI layer only', () => {
    const ruleset = resolveEffectiveRuleset([fciLayer], RESOLVE_DATE);

    it('stamps the resolution date', () => {
        expect(ruleset.resolvedAt).toEqual(RESOLVE_DATE);
    });

    it('records FCI as the sole source layer', () => {
        expect(ruleset.sourceLayerIds).toEqual([FCI_LAYER_ID]);
    });

    it('carries all 10 FCI class definitions', () => {
        expect(ruleset.classDefinitions).toHaveLength(10);
    });

    it('carries both FCI grade scales (adult and puppy)', () => {
        expect(ruleset.gradeScales).toHaveLength(2);
    });

    it('carries all 15 FCI award types', () => {
        expect(ruleset.awardTypes).toHaveLength(15);
    });
});

// ---------------------------------------------------------------------------
// KMSH layer — structure
// ---------------------------------------------------------------------------

describe('kmshLayer — structure', () => {
    it('has the expected KMSH layer ID', () => {
        expect(kmshLayer.id).toBe(KMSH_LAYER_ID);
    });

    it('has FCI as parent layer', () => {
        expect(kmshLayer.parentLayerId).toBe(FCI_LAYER_ID);
    });

    it('overrides Minor Puppy class with fromAgeMonths=3 (KMSH ART.23)', () => {
        const cls = kmshLayer.classDefinitions.find((c) => c.id === 'minor-puppy');
        expect(cls).toBeDefined();
        expect(cls!.fromAgeMonths).toBe(3);
        expect(cls!.lessThanAgeMonths).toBe(6);
    });

    it('adds the Fokkersklas class with bredByExhibitor=true', () => {
        const cls = kmshLayer.classDefinitions.find((c) => c.id === KMSH_CLASS_FOKKERSKLAS);
        expect(cls).toBeDefined();
        expect(cls!.bredByExhibitor).toBe(true);
        expect(cls!.fromAgeMonths).toBe(15);
    });

    it('Fokkersklas feeds both CAC and RCAC', () => {
        const cls = kmshLayer.classDefinitions.find((c) => c.id === KMSH_CLASS_FOKKERSKLAS);
        expect(cls!.awardTypeIds).toContain(KMSH_AWARD_CAC);
        expect(cls!.awardTypeIds).toContain(KMSH_AWARD_RCAC);
    });

    it('adds the national CAC award type', () => {
        const at = kmshLayer.awardTypes.find((a) => a.id === KMSH_AWARD_CAC);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
    });

    it('adds the RCAC award type', () => {
        const at = kmshLayer.awardTypes.find(
            (a): a is IndividualAwardType => a.id === KMSH_AWARD_RCAC && a.scope !== 'collective',
        );
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBeUndefined();
    });

    it('KMSH layer adds no grade scale overrides (language is not a rule difference, ADR-0010)', () => {
        // Grade scales are NOT overridden by KMSH — language is not a rule
        // difference (ADR-0010). The KMSH layer leaves gradeScales empty.
        expect(kmshLayer.gradeScales).toHaveLength(0);
    });

    it('puppy scale has no special outcomes in the KMSH layer (no grade scale overrides)', () => {
        // Not applicable — KMSH does not override grade scales (ADR-0010).
        expect(kmshLayer.gradeScales).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// resolveEffectiveRuleset([fciLayer, kmshLayer], date) — composed snapshot
// ---------------------------------------------------------------------------

describe('resolveEffectiveRuleset with FCI + KMSH layers', () => {
    const ruleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);

    it('records both source layers in order', () => {
        expect(ruleset.sourceLayerIds).toEqual([FCI_LAYER_ID, KMSH_LAYER_ID]);
    });

    it('has 11 class definitions (10 FCI — Fokkersklas and MinorPuppy are KMSH overrides/additions)', () => {
        expect(ruleset.classDefinitions).toHaveLength(11);
    });

    it('Fokkersklas is present with bredByExhibitor=true', () => {
        const cls = ruleset.classDefinitions.find((c) => c.id === KMSH_CLASS_FOKKERSKLAS);
        expect(cls).toBeDefined();
        expect(cls!.bredByExhibitor).toBe(true);
    });

    it('Minor Puppy class is overridden with fromAgeMonths=3', () => {
        const cls = ruleset.classDefinitions.find((c) => c.id === 'minor-puppy');
        expect(cls!.fromAgeMonths).toBe(3);
    });

    it('has 17 award types (15 FCI + CAC + RCAC)', () => {
        expect(ruleset.awardTypes).toHaveLength(17);
    });

    it('national CAC is present in the composed ruleset', () => {
        const at = ruleset.awardTypes.find((a) => a.id === KMSH_AWARD_CAC);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
    });

    it('both FCI grade scales are unchanged (KMSH adds no grade scale overrides per ADR-0010)', () => {
        expect(ruleset.gradeScales).toHaveLength(2);
        const adult = ruleset.gradeScales.find((s) => s.id === 'fci-adult');
        expect(adult!.grades[0]!.id).toBe(FCI_GRADE_EXCELLENT);
    });

    it('all original FCI classes are present', () => {
        const fciClassIds = fciLayer.classDefinitions.map((c) => c.id);
        for (const id of fciClassIds) {
            expect(ruleset.classDefinitions.find((c) => c.id === id)).toBeDefined();
        }
    });
});

// ---------------------------------------------------------------------------
// fedBy layering — FCI base vs KMSH override (ADR-0017, last-layer-wins)
// ---------------------------------------------------------------------------

describe('fedBy layering — FCI base vs KMSH override', () => {
    const individual = (ruleset: EffectiveRuleset, id: AwardTypeId): IndividualAwardType => {
        const at = ruleset.awardTypes.find((a) => a.id === id);
        if (!at || at.scope === 'collective') {
            throw new Error(`individual award type ${id} not found`);
        }
        return at as IndividualAwardType;
    };

    it('FCI-only: BOB fedBy has no national CAC feeder', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer], RESOLVE_DATE);
        expect(individual(ruleset, FCI_AWARD_BOB).fedBy).toEqual([
            { awardTypeId: FCI_AWARD_CACIB },
            { classId: asClassId('junior') },
            { classId: asClassId('veteran') },
        ]);
    });

    it('FCI-only: BOS fedBy has no national CAC feeder', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer], RESOLVE_DATE);
        expect(individual(ruleset, FCI_AWARD_BOS).fedBy).toEqual([
            { awardTypeId: FCI_AWARD_CACIB },
            { classId: asClassId('junior') },
            { classId: asClassId('veteran') },
        ]);
    });

    it('FCI + KMSH: BOB fedBy adds the national CAC feeder (wholesale override)', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);
        expect(individual(ruleset, FCI_AWARD_BOB).fedBy).toEqual([
            { awardTypeId: FCI_AWARD_CACIB },
            { awardTypeId: KMSH_AWARD_CAC },
            { classId: asClassId('junior') },
            { classId: asClassId('veteran') },
        ]);
    });

    it('FCI + KMSH: BOS fedBy adds the national CAC feeder (wholesale override)', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);
        expect(individual(ruleset, FCI_AWARD_BOS).fedBy).toEqual([
            { awardTypeId: FCI_AWARD_CACIB },
            { awardTypeId: KMSH_AWARD_CAC },
            { classId: asClassId('junior') },
            { classId: asClassId('veteran') },
        ]);
    });

    it('FCI + KMSH: BIG/BIS feeders are unchanged by the KMSH layer', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);
        expect(individual(ruleset, FCI_AWARD_BIG).fedBy).toEqual([{ awardTypeId: FCI_AWARD_BOB }]);
        expect(individual(ruleset, FCI_AWARD_BIS).fedBy).toEqual([{ awardTypeId: FCI_AWARD_BIG }]);
    });

    it('FCI + KMSH: Best Junior/Veteran/Puppy/Minor Puppy feeders are unchanged', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);
        expect(individual(ruleset, FCI_AWARD_BEST_JUNIOR).fedBy).toEqual([
            { classId: asClassId('junior') },
        ]);
        expect(individual(ruleset, FCI_AWARD_BEST_VETERAN).fedBy).toEqual([
            { classId: asClassId('veteran') },
        ]);
        expect(individual(ruleset, FCI_AWARD_BEST_PUPPY).fedBy).toEqual([
            { classId: asClassId('puppy') },
        ]);
        expect(individual(ruleset, FCI_AWARD_BEST_MINOR_PUPPY).fedBy).toEqual([
            { classId: asClassId('minor-puppy') },
        ]);
    });

    it('FCI + KMSH: national CAC award type has no fedBy (per-sex)', () => {
        const ruleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);
        expect(individual(ruleset, KMSH_AWARD_CAC).fedBy).toBeUndefined();
    });
});
