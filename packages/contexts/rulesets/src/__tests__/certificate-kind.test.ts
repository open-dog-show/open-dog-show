// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { CertificateKind } from '../domain/value-objects/certificate-kind.js';

describe('CertificateKind', () => {
    it('has the champion-certificate value', () => {
        expect(CertificateKind.ChampionCertificate).toBe('champion-certificate');
    });

    it('has the working-certificate value', () => {
        expect(CertificateKind.WorkingCertificate).toBe('working-certificate');
    });

    it('has the vaccination value', () => {
        expect(CertificateKind.Vaccination).toBe('vaccination');
    });

    it('has exactly three values', () => {
        expect(Object.values(CertificateKind)).toHaveLength(3);
    });
});
