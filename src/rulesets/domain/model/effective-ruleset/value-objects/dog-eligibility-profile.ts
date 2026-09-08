// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CertificateKind } from './certificate-kind.js';
import type { LocalDate } from './local-date.js';

/**
 * The dog-side snapshot the Entries context passes to
 * {@link ClassEligibilityPolicy} when checking whether a dog may enter a
 * given class.  Contains only the fields that matter for eligibility rules —
 * not the full Dog entity.
 */
export interface DogEligibilityProfile {
    readonly dateOfBirth: LocalDate;
    readonly heldCertificates: ReadonlyArray<CertificateKind>;
}
