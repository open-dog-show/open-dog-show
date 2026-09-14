// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { EntryEligibilityProfile } from '../../../../../src/rulesets/domain/service/class-eligibility-policy/entry-eligibility-profile.js';
import { CERTIFICATE_KIND } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/certificate-kind.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';

const DOB = LocalDate.of(2024, 6, 1);
const OTHER_DOB = LocalDate.of(2024, 7, 1);

function profile(overrides: Partial<Parameters<typeof EntryEligibilityProfile.of>[0]> = {}) {
    return EntryEligibilityProfile.of({
        dateOfBirth: DOB,
        heldCertificates: [],
        handlerIsBreederOfDog: false,
        ...overrides,
    });
}

describe('EntryEligibilityProfile.equals', () => {
    it('is true when every field matches', () => {
        expect(
            profile({ heldCertificates: [CERTIFICATE_KIND.VaccinationCertificate] }).equals(
                profile({ heldCertificates: [CERTIFICATE_KIND.VaccinationCertificate] }),
            ),
        ).toBe(true);
    });

    it('is false when dateOfBirth differs', () => {
        expect(profile({ dateOfBirth: DOB }).equals(profile({ dateOfBirth: OTHER_DOB }))).toBe(
            false,
        );
    });

    it('is false when handlerIsBreederOfDog differs', () => {
        expect(
            profile({ handlerIsBreederOfDog: true }).equals(
                profile({ handlerIsBreederOfDog: false }),
            ),
        ).toBe(false);
    });

    it('is false when heldCertificates differ in content', () => {
        expect(
            profile({ heldCertificates: [CERTIFICATE_KIND.VaccinationCertificate] }).equals(
                profile({ heldCertificates: [CERTIFICATE_KIND.WorkingCertificate] }),
            ),
        ).toBe(false);
    });

    it('is false when heldCertificates differ in length', () => {
        expect(
            profile({
                heldCertificates: [
                    CERTIFICATE_KIND.VaccinationCertificate,
                    CERTIFICATE_KIND.WorkingCertificate,
                ],
            }).equals(profile({ heldCertificates: [CERTIFICATE_KIND.VaccinationCertificate] })),
        ).toBe(false);
    });
});
