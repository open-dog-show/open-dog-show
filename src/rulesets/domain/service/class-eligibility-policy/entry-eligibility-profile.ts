// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CertificateKind } from '../../model/effective-ruleset/value-objects/certificate-kind.js';
import type { LocalDate } from '../../model/effective-ruleset/value-objects/local-date.js';

/** Attributes for {@link EntryEligibilityProfile.of}. */
export interface EntryEligibilityProfileAttributes {
    readonly dateOfBirth: LocalDate;
    readonly heldCertificates: ReadonlyArray<CertificateKind>;
    readonly handlerIsBreederOfDog: boolean;
}

/**
 * The snapshot of one prospective Entry that the Entries & Registration
 * context assembles and passes to {@link ClassEligibilityPolicy} when asking
 * whether a Dog may enter a specific Class: the Dog's date of birth and held
 * certificates, and whether its Handler is a breeder or co-breeder of the
 * Dog. Contains exactly the facts the Rulesets context needs for eligibility
 * evaluation — not the full Dog entity.
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * EntryEligibilityProfile.of} validating factory is the only construction
 * path (V2/V3). The fields carry no independent invariant of their own, so
 * the factory is a pass-through (mirrors {@link RoleScope}).
 */
export class EntryEligibilityProfile {
    readonly dateOfBirth: LocalDate;

    readonly heldCertificates: ReadonlyArray<CertificateKind>;

    readonly handlerIsBreederOfDog: boolean;

    private constructor(attributes: EntryEligibilityProfileAttributes) {
        this.dateOfBirth = attributes.dateOfBirth;
        this.heldCertificates = [...attributes.heldCertificates];
        this.handlerIsBreederOfDog = attributes.handlerIsBreederOfDog;
    }

    static of(attributes: EntryEligibilityProfileAttributes): EntryEligibilityProfile {
        return new EntryEligibilityProfile(attributes);
    }

    /** Value equality — compares every field. */
    equals(other: EntryEligibilityProfile): boolean {
        return (
            this.dateOfBirth.equals(other.dateOfBirth) &&
            this.handlerIsBreederOfDog === other.handlerIsBreederOfDog &&
            this.heldCertificates.length === other.heldCertificates.length &&
            this.heldCertificates.every((c, i) => c === other.heldCertificates[i])
        );
    }
}
