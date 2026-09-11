// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CertificateKind } from './certificate-kind.js';
import type { LocalDate } from './local-date.js';

/** Attributes for {@link DogEligibilityProfile.of}. */
export interface DogEligibilityProfileAttributes {
    readonly dateOfBirth: LocalDate;
    readonly heldCertificates: ReadonlyArray<CertificateKind>;
    readonly handlerIsBreeder: boolean;
}

/**
 * The dog-side snapshot the Entries context passes to
 * {@link ClassEligibilityPolicy} when checking whether a dog may enter a
 * given class. Contains only the fields that matter for eligibility rules —
 * not the full Dog entity.
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * DogEligibilityProfile.of} validating factory is the only construction path
 * (V2/V3). The fields carry no independent invariant of their own, so the
 * factory is a pass-through (mirrors {@link RoleScope}).
 */
export class DogEligibilityProfile {
    readonly dateOfBirth: LocalDate;

    readonly heldCertificates: ReadonlyArray<CertificateKind>;

    readonly handlerIsBreeder: boolean;

    private constructor(attributes: DogEligibilityProfileAttributes) {
        this.dateOfBirth = attributes.dateOfBirth;
        this.heldCertificates = [...attributes.heldCertificates];
        this.handlerIsBreeder = attributes.handlerIsBreeder;
    }

    static of(attributes: DogEligibilityProfileAttributes): DogEligibilityProfile {
        return new DogEligibilityProfile(attributes);
    }

    /** Value equality — compares every field. */
    equals(other: DogEligibilityProfile): boolean {
        return (
            this.dateOfBirth.equals(other.dateOfBirth) &&
            this.handlerIsBreeder === other.handlerIsBreeder &&
            this.heldCertificates.length === other.heldCertificates.length &&
            this.heldCertificates.every((c, i) => c === other.heldCertificates[i])
        );
    }
}
