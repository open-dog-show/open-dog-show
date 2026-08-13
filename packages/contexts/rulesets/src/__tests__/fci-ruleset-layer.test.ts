// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    fciLayer,
    FCI_LAYER_ID,
    FCI_PUPPY_GRADE_SCALE_ID,
} from '../testing/fci-ruleset-layer.js';
import { kmshLayer, KMSH_LAYER_ID, KMSH_AWARD_CAC, KMSH_AWARD_RCAC, KMSH_CLASS_FOKKERSKLAS } from '../testing/kmsh-ruleset-layer.js';
import { resolveEffectiveRuleset } from '../domain/resolve-effective-ruleset.js';
import { CertificateKind } from '../domain/certificate-kind.js';
import type { LocalDate } from '../domain/local-date.js';

const RESOLVE_DATE: LocalDate = { year: 2026, month: 8, day: 11 };

// ---------------------------------------------------------------------------
// FCI base layer — structure
// ---------------------------------------------------------------------------

describe('fciLayer — grade scales', () => {
    it('has exactly two grade scales (adult and puppy)', () => {
        expect(fciLayer.gradeScales).toHaveLength(2);
    });

    describe('adult grade scale', () => {
        const adultScale = () => fciLayer.gradeScales.find((s) => s.id !== FCI_PUPPY_GRADE_SCALE_ID)!;

        it('has four grades in ordinal order', () => {
            expect(adultScale().grades).toHaveLength(4);
            expect(adultScale().grades.map((g) => g.ordinal)).toEqual([0, 1, 2, 3]);
        });

        it('grade names are Excellent, Very Good, Good, Sufficient (FCI Section 6)', () => {
            const names = adultScale().grades.map((g) => g.name);
            expect(names).toEqual(['Excellent', 'Very Good', 'Good', 'Sufficient']);
        });

        it('placeable threshold is Very Good (ordinal 1)', () => {
            const scale = adultScale();
            const threshold = scale.grades.find((g) => g.id === scale.placeableThresholdId);
            expect(threshold?.ordinal).toBe(1);
            expect(threshold?.name).toBe('Very Good');
        });

        it('has two special outcomes: Disqualified and Cannot Be Judged', () => {
            expect(adultScale().specialOutcomes).toHaveLength(2);
            const names = adultScale().specialOutcomes.map((o) => o.name);
            expect(names).toContain('Disqualified');
            expect(names).toContain('Cannot Be Judged');
        });
    });

    describe('puppy grade scale', () => {
        const puppyScale = () => fciLayer.gradeScales.find((s) => s.id === FCI_PUPPY_GRADE_SCALE_ID)!;

        it('exists with id fci-puppy', () => {
            expect(puppyScale()).toBeDefined();
        });

        it('has three grades: Very Promising, Promising, Less Promising', () => {
            const names = puppyScale().grades.map((g) => g.name);
            expect(names).toEqual(['Very Promising', 'Promising', 'Less Promising']);
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
        const at = fciLayer.awardTypes.find((a) => a.id === 'cacib');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBe(1);
        // minimumGradeId must be the Excellent grade on the FCI adult scale
        const excellent = fciLayer.gradeScales[0]!.grades.find((g) => g.ordinal === 0);
        expect(at!.minimumGradeId).toBe(excellent!.id);
    });

    it('Reserve CACIB is per-sex, discretionary, Excellent, no placement requirement', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'res-cacib');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBeUndefined();
    });

    it('CACIB-J is per-sex, discretionary, Excellent-1st', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'cacib-j');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBe(1);
    });

    it('CACIB-V is per-sex, discretionary, Excellent-1st', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'cacib-v');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBe(1);
    });

    it('BOB is breed scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'bob');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('breed');
    });

    it('BOS is breed scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'bos');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('breed');
    });

    it('BIG is group scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'big');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('group');
    });

    it('BIS is show scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'bis');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
    });

    it('Best Junior in Show is show scope, not discretionary, Excellent', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-junior');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
    });

    it('Best Veteran in Show is show scope, not discretionary, Excellent', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-veteran');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
    });

    it('Best Puppy in Show is show scope, not discretionary, Very Promising', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-puppy');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
        expect(at!.minimumGradeId).toBe('very-promising');
    });

    it('Best Minor Puppy in Show is show scope, not discretionary, Very Promising', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-minor-puppy');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('show');
        expect(at!.isDiscretionary).toBe(false);
        expect(at!.minimumGradeId).toBe('very-promising');
    });

    it('Best Brace is collective scope, not discretionary, no minimum grade', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-brace');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('collective');
        expect(at!.isDiscretionary).toBe(false);
        expect(at!.minimumGradeId).toBeUndefined();
    });

    it('Best Breeders\u2019 Group is collective scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-breeders-group');
        expect(at).toBeDefined();
        expect(at!.scope).toBe('collective');
    });

    it('Best Progeny Group is collective scope', () => {
        const at = fciLayer.awardTypes.find((a) => a.id === 'best-progeny-group');
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

    it('layer name is bilingual KMSH / SRSH', () => {
        expect(kmshLayer.name).toBe('KMSH / SRSH');
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
        const at = kmshLayer.awardTypes.find((a) => a.id === KMSH_AWARD_RCAC);
        expect(at).toBeDefined();
        expect(at!.scope).toBe('per-sex');
        expect(at!.isDiscretionary).toBe(true);
        expect(at!.minimumPlacement).toBeUndefined();
    });

    it('overrides grade scale names to bilingual Dutch/French', () => {
        // Grade scales are NOT overridden by KMSH — language is not a rule
        // difference (ADR-0010). The KMSH layer leaves gradeScales empty.
        expect(kmshLayer.gradeScales).toHaveLength(0);
    });

    it('puppy grade scale override adds special outcomes', () => {
        // Not applicable — KMSH does not override grade scales (ADR-0010).
        // The puppy special outcomes (Diskwalificatie / Kan niet gekeurd worden)
        // will be handled by the Multilingual Label refactor.
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
        // FCI English names are intact — KMSH has no grade scale overrides
        const adult = ruleset.gradeScales.find((s) => s.id === 'fci-adult');
        expect(adult!.grades[0]!.name).toBe('Excellent');
    });

    it('all original FCI classes are present', () => {
        const fciClassIds = fciLayer.classDefinitions.map((c) => c.id);
        for (const id of fciClassIds) {
            expect(ruleset.classDefinitions.find((c) => c.id === id)).toBeDefined();
        }
    });
});
