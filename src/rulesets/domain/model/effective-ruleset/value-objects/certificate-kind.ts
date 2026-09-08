// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The three certificate kinds an exhibitor may assert on a Dog.
 * Stored as owner-asserted data; the platform does not verify issuance.
 */
export const CertificateKind = {
    ChampionCertificate: 'champion-certificate',
    WorkingCertificate: 'working-certificate',
    Vaccination: 'vaccination',
} as const;

/** Union type of all valid {@link CertificateKind} values. */
export type CertificateKind = (typeof CertificateKind)[keyof typeof CertificateKind];
