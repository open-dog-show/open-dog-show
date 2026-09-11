// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { DogEligibilityProfile } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/dog-eligibility-profile.js';
import { CertificateKind } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/certificate-kind.js';
import { LocalDate } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';

const DOB = LocalDate.of(2024, 6, 1);
const OTHER_DOB = LocalDate.of(2024, 7, 1);

function profile(overrides: Partial<Parameters<typeof DogEligibilityProfile.of>[0]> = {}) {
    return DogEligibilityProfile.of({
        dateOfBirth: DOB,
        heldCertificates: [],
        handlerIsBreeder: false,
        ...overrides,
    });
}

describe('DogEligibilityProfile.equals', () => {
    it('is true when every field matches', () => {
        expect(
            profile({ heldCertificates: [CertificateKind.Vaccination] }).equals(
                profile({ heldCertificates: [CertificateKind.Vaccination] }),
            ),
        ).toBe(true);
    });

    it('is false when dateOfBirth differs', () => {
        expect(profile({ dateOfBirth: DOB }).equals(profile({ dateOfBirth: OTHER_DOB }))).toBe(
            false,
        );
    });

    it('is false when handlerIsBreeder differs', () => {
        expect(
            profile({ handlerIsBreeder: true }).equals(profile({ handlerIsBreeder: false })),
        ).toBe(false);
    });

    it('is false when heldCertificates differ in content', () => {
        expect(
            profile({ heldCertificates: [CertificateKind.Vaccination] }).equals(
                profile({ heldCertificates: [CertificateKind.WorkingCertificate] }),
            ),
        ).toBe(false);
    });

    it('is false when heldCertificates differ in length', () => {
        expect(
            profile({
                heldCertificates: [CertificateKind.Vaccination, CertificateKind.WorkingCertificate],
            }).equals(profile({ heldCertificates: [CertificateKind.Vaccination] })),
        ).toBe(false);
    });
});
