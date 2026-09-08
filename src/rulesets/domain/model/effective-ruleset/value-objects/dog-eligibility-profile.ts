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
    /**
     * Whether the dog's handler is also its breeder — entry-side data that drives
     * the Bred-by-Exhibitor class rule. Lives in the profile alongside the other
     * entry-side facts (e.g. `heldCertificates`) rather than trailing the
     * `isEligible` parameter list as a bare boolean.
     */
    readonly handlerIsBreeder: boolean;
}
