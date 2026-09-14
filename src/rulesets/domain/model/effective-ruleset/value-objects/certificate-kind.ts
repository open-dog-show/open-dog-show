// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The three certificate kinds that may be recorded on a Dog. Each is
 * **owner-asserted** data — recorded by the Owner; the platform stores but
 * does not verify or confirm issuance.
 */
export const CERTIFICATE_KIND = {
    ChampionCertificate: 'champion-certificate',
    WorkingCertificate: 'working-certificate',
    VaccinationCertificate: 'vaccination-certificate',
} as const;

/** Union type of all valid {@link CERTIFICATE_KIND} values. */
export type CertificateKind = (typeof CERTIFICATE_KIND)[keyof typeof CERTIFICATE_KIND];
