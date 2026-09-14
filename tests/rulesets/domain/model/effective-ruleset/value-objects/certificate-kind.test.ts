// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { CERTIFICATE_KIND } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/certificate-kind.js';

describe('CertificateKind', () => {
    it('has the champion-certificate value', () => {
        expect(CERTIFICATE_KIND.ChampionCertificate).toBe('champion-certificate');
    });

    it('has the working-certificate value', () => {
        expect(CERTIFICATE_KIND.WorkingCertificate).toBe('working-certificate');
    });

    it('has the vaccination-certificate value', () => {
        expect(CERTIFICATE_KIND.VaccinationCertificate).toBe('vaccination-certificate');
    });

    it('has exactly three values', () => {
        expect(Object.values(CERTIFICATE_KIND)).toHaveLength(3);
    });
});
