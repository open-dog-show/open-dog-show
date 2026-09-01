// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { FciClassEligibilityPolicy } from '../testing/fci-class-eligibility-policy.js';
import { asClassId, asGradeScaleId } from '../domain/domain-ids.js';
import { asAgeMonths } from '../domain/age-months.js';
import { CertificateKind } from '../domain/certificate-kind.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { DogEligibilityProfile } from '../domain/dog-eligibility-profile.js';
import type { LocalDate } from '../domain/local-date.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Show day used throughout the suite. */
const SHOW_DATE: LocalDate = { year: 2026, month: 8, day: 4 };

/**
 * Born exactly 3 months before show day: `completedMonths(2026-05-04, 2026-08-04) === 3`.
 */
const BORN_EXACTLY_3M: LocalDate = { year: 2026, month: 5, day: 4 };
/** Born one day later → 2 completed months on show day. */
const BORN_UNDER_3M: LocalDate = { year: 2026, month: 5, day: 5 };
/** Born one day earlier → 3 completed months on show day. */
const BORN_OVER_3M: LocalDate = { year: 2026, month: 5, day: 3 };

type ClassDefOverrides = Partial<Omit<ClassDefinition, 'fromAgeMonths' | 'lessThanAgeMonths'>> & {
    fromAgeMonths?: number | undefined;
    lessThanAgeMonths?: number | undefined;
};

function makeClass(overrides: ClassDefOverrides = {}): ClassDefinition {
    const { fromAgeMonths, lessThanAgeMonths, ...rest } = overrides;
    return {
        id: asClassId('test-class'),
        fromAgeMonths: fromAgeMonths === undefined ? undefined : asAgeMonths(fromAgeMonths),
        lessThanAgeMonths:
            lessThanAgeMonths === undefined ? undefined : asAgeMonths(lessThanAgeMonths),
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: asGradeScaleId('standard'),
        awardTypeIds: [],
        ...rest,
    };
}

function makeProfile(overrides: Partial<DogEligibilityProfile> = {}): DogEligibilityProfile {
    return {
        dateOfBirth: BORN_EXACTLY_3M,
        heldCertificates: [],
        ...overrides,
    };
}

const policy = new FciClassEligibilityPolicy();

// ---------------------------------------------------------------------------
// Age-window rules
// ---------------------------------------------------------------------------

describe('FciClassEligibilityPolicy — age window', () => {
    describe('fromAgeMonths', () => {
        it('is ineligible when dog is younger than fromAgeMonths', () => {
            const classDef = makeClass({ fromAgeMonths: 3 });
            const profile = makeProfile({ dateOfBirth: BORN_UNDER_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
        });

        it('is eligible when dog age equals fromAgeMonths exactly (boundary)', () => {
            const classDef = makeClass({ fromAgeMonths: 3 });
            const profile = makeProfile({ dateOfBirth: BORN_EXACTLY_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });

        it('is eligible when dog age is greater than fromAgeMonths', () => {
            const classDef = makeClass({ fromAgeMonths: 3 });
            const profile = makeProfile({ dateOfBirth: BORN_OVER_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });

        it('applies no lower-bound check when fromAgeMonths is undefined', () => {
            const classDef = makeClass({ fromAgeMonths: undefined, lessThanAgeMonths: 10 });
            const profile = makeProfile({ dateOfBirth: BORN_UNDER_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });
    });

    describe('lessThanAgeMonths', () => {
        it('is ineligible when dog age equals lessThanAgeMonths (moves to higher class)', () => {
            const classDef = makeClass({ lessThanAgeMonths: 3 });
            const profile = makeProfile({ dateOfBirth: BORN_EXACTLY_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
        });

        it('is ineligible when dog age exceeds lessThanAgeMonths', () => {
            const classDef = makeClass({ lessThanAgeMonths: 3 });
            const profile = makeProfile({ dateOfBirth: BORN_OVER_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
        });

        it('is eligible when dog age is strictly less than lessThanAgeMonths', () => {
            const classDef = makeClass({ lessThanAgeMonths: 3 });
            const profile = makeProfile({ dateOfBirth: BORN_UNDER_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });

        it('applies no upper-bound check when lessThanAgeMonths is undefined', () => {
            const classDef = makeClass({ fromAgeMonths: 3, lessThanAgeMonths: undefined });
            const profile = makeProfile({ dateOfBirth: BORN_OVER_3M });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });
    });

    it('is eligible when dog age is within the fromAgeMonths/lessThanAgeMonths window', () => {
        const classDef = makeClass({ fromAgeMonths: 3, lessThanAgeMonths: 6 });
        const profile = makeProfile({ dateOfBirth: BORN_OVER_3M });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });

    it('is ineligible when showDate is before dateOfBirth (negative age guard)', () => {
        const classDef = makeClass(); // no age bounds
        const futureBirth: LocalDate = { year: 2026, month: 9, day: 1 };
        const profile = makeProfile({ dateOfBirth: futureBirth });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Required certificate rules
// ---------------------------------------------------------------------------

describe('FciClassEligibilityPolicy — required certificates', () => {
    it('is ineligible when champion-certificate is required but not held', () => {
        const classDef = makeClass({ requiredCertificates: [CertificateKind.ChampionCertificate] });
        const profile = makeProfile({ heldCertificates: [] });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
    });

    it('is eligible when champion-certificate is required and held', () => {
        const classDef = makeClass({ requiredCertificates: [CertificateKind.ChampionCertificate] });
        const profile = makeProfile({
            heldCertificates: [CertificateKind.ChampionCertificate],
        });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });

    it('is ineligible when working-certificate is required but not held', () => {
        const classDef = makeClass({ requiredCertificates: [CertificateKind.WorkingCertificate] });
        const profile = makeProfile({ heldCertificates: [] });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
    });

    it('is eligible when working-certificate is required and held', () => {
        const classDef = makeClass({ requiredCertificates: [CertificateKind.WorkingCertificate] });
        const profile = makeProfile({
            heldCertificates: [CertificateKind.WorkingCertificate],
        });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });

    it('is ineligible when vaccination is required but not held', () => {
        const classDef = makeClass({ requiredCertificates: [CertificateKind.Vaccination] });
        const profile = makeProfile({ heldCertificates: [] });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
    });

    it('is eligible when vaccination is required and held', () => {
        const classDef = makeClass({ requiredCertificates: [CertificateKind.Vaccination] });
        const profile = makeProfile({ heldCertificates: [CertificateKind.Vaccination] });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });

    it('is ineligible when one of multiple required certificates is missing', () => {
        const classDef = makeClass({
            requiredCertificates: [
                CertificateKind.ChampionCertificate,
                CertificateKind.Vaccination,
            ],
        });
        const profile = makeProfile({
            heldCertificates: [CertificateKind.ChampionCertificate],
        });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Bred-by-Exhibitor rule
// ---------------------------------------------------------------------------

describe('FciClassEligibilityPolicy — requiresBreederHandler', () => {
    it('is ineligible when bredByExhibitor is true and handlerIsBreeder is false', () => {
        const classDef = makeClass({ bredByExhibitor: true });
        const profile = makeProfile();

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
    });

    it('is eligible when bredByExhibitor is true and handlerIsBreeder is true', () => {
        const classDef = makeClass({ bredByExhibitor: true });
        const profile = makeProfile();

        expect(policy.isEligible(classDef, profile, SHOW_DATE, true)).toBe(true);
    });

    it('is eligible when bredByExhibitor is false regardless of handlerIsBreeder', () => {
        const classDef = makeClass({ bredByExhibitor: false });
        const profile = makeProfile();

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Open class (no restrictions)
// ---------------------------------------------------------------------------

describe('FciClassEligibilityPolicy — class with no certificate restrictions', () => {
    it('is eligible for any age-eligible dog when requiredCertificates is empty and bredByExhibitor is false', () => {
        const classDef = makeClass({
            fromAgeMonths: 3,
            requiredCertificates: [],
            bredByExhibitor: false,
        });
        const profile = makeProfile({ dateOfBirth: BORN_OVER_3M, heldCertificates: [] });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });
});
