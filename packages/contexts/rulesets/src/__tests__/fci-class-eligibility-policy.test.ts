// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { FciClassEligibilityPolicy } from '../testing/fci-class-eligibility-policy.js';
import { asClassId, asGradeScaleId } from '../domain/domain-ids.js';
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
 * From 2026-05-06 to 2026-08-04: 25 (rem. May) + 30 (Jun) + 31 (Jul) + 4 (Aug) = 90 days.
 */
const AGE_90_DAYS: LocalDate = { year: 2026, month: 5, day: 6 };
/** One day younger → 89 days on show day. */
const AGE_89_DAYS: LocalDate = { year: 2026, month: 5, day: 7 };
/** One day older → 91 days on show day. */
const AGE_91_DAYS: LocalDate = { year: 2026, month: 5, day: 5 };

function makeClass(overrides: Partial<ClassDefinition> = {}): ClassDefinition {
    return {
        id: asClassId('test-class'),
        name: 'Test Class',
        minAgeDays: undefined,
        maxAgeDays: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: asGradeScaleId('standard'),
        awardTypeIds: [],
        ...overrides,
    };
}

function makeProfile(overrides: Partial<DogEligibilityProfile> = {}): DogEligibilityProfile {
    return {
        dateOfBirth: AGE_90_DAYS,
        heldCertificates: [],
        ...overrides,
    };
}

const policy = new FciClassEligibilityPolicy();

// ---------------------------------------------------------------------------
// Age-window rules
// ---------------------------------------------------------------------------

describe('FciClassEligibilityPolicy — age window', () => {
    describe('minAgeDays', () => {
        it('is ineligible when dog is younger than minAgeDays', () => {
            const classDef = makeClass({ minAgeDays: 90 });
            const profile = makeProfile({ dateOfBirth: AGE_89_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
        });

        it('is eligible when dog age equals minAgeDays exactly (boundary)', () => {
            const classDef = makeClass({ minAgeDays: 90 });
            const profile = makeProfile({ dateOfBirth: AGE_90_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });

        it('is eligible when dog age is greater than minAgeDays', () => {
            const classDef = makeClass({ minAgeDays: 90 });
            const profile = makeProfile({ dateOfBirth: AGE_91_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });

        it('applies no lower-bound check when minAgeDays is undefined', () => {
            const classDef = makeClass({ minAgeDays: undefined, maxAgeDays: 200 });
            const profile = makeProfile({ dateOfBirth: AGE_89_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });
    });

    describe('maxAgeDays', () => {
        it('is ineligible when dog age equals maxAgeDays (moves to higher class)', () => {
            const classDef = makeClass({ maxAgeDays: 90 });
            const profile = makeProfile({ dateOfBirth: AGE_90_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
        });

        it('is ineligible when dog age exceeds maxAgeDays', () => {
            const classDef = makeClass({ maxAgeDays: 90 });
            const profile = makeProfile({ dateOfBirth: AGE_91_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(false);
        });

        it('is eligible when dog age is strictly less than maxAgeDays', () => {
            const classDef = makeClass({ maxAgeDays: 90 });
            const profile = makeProfile({ dateOfBirth: AGE_89_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });

        it('applies no upper-bound check when maxAgeDays is undefined', () => {
            const classDef = makeClass({ minAgeDays: 90, maxAgeDays: undefined });
            const profile = makeProfile({ dateOfBirth: AGE_91_DAYS });

            expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
        });
    });

    it('is eligible when dog age is within the min/max window', () => {
        const classDef = makeClass({ minAgeDays: 90, maxAgeDays: 180 });
        const profile = makeProfile({ dateOfBirth: AGE_91_DAYS });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
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

describe('FciClassEligibilityPolicy — open class (no restrictions)', () => {
    it('is eligible for any age-eligible dog when requiredCertificates is empty and bredByExhibitor is false', () => {
        const classDef = makeClass({
            minAgeDays: 90,
            requiredCertificates: [],
            bredByExhibitor: false,
        });
        const profile = makeProfile({ dateOfBirth: AGE_91_DAYS, heldCertificates: [] });

        expect(policy.isEligible(classDef, profile, SHOW_DATE, false)).toBe(true);
    });
});
