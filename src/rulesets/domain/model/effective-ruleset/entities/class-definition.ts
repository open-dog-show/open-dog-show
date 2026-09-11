// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeScaleId, AwardTypeId } from '../value-objects/domain-ids.js';
import type { AgeMonths } from '../value-objects/age-months.js';
import type { CertificateKind } from '../value-objects/certificate-kind.js';

/** Attributes for {@link ClassDefinition.of}. */
export interface ClassDefinitionAttributes {
    readonly id: ClassId;
    /** Minimum age in whole calendar months on show day (FCI: "from X months"). Undefined = no lower bound. */
    readonly fromAgeMonths: AgeMonths | undefined;
    /** Exclusive upper age in whole calendar months on show day (FCI: "less than Y months"). Undefined = no upper bound. */
    readonly lessThanAgeMonths: AgeMonths | undefined;
    /** Entry certificates required to enter this Class. */
    readonly requiredCertificates: ReadonlyArray<CertificateKind>;
    /** Whether the Bred-by-Exhibitor handler condition applies. */
    readonly bredByExhibitor: boolean;
    readonly gradeScaleId: GradeScaleId;
    /** AwardTypes that Dogs in this Class are eligible to feed. */
    readonly awardTypeIds: ReadonlyArray<AwardTypeId>;
}

/**
 * The ruleset-owned data record for a single Class — eligibility rules,
 * the {@link GradeScale} used, and the {@link AwardType}s the class feeds.
 *
 * Age is evaluated on the show day; a Dog that reaches an age boundary
 * on show day moves to the higher class (FCI 2026; KMSH ART.23).
 *
 * An entity (ADR-0022): private constructor plus the {@link
 * ClassDefinition.of} factory is the only construction path. Identified
 * by `id`, not by value.
 */
export class ClassDefinition {
    readonly id: ClassId;
    readonly fromAgeMonths: AgeMonths | undefined;
    readonly lessThanAgeMonths: AgeMonths | undefined;
    readonly requiredCertificates: ReadonlyArray<CertificateKind>;
    readonly bredByExhibitor: boolean;
    readonly gradeScaleId: GradeScaleId;
    readonly awardTypeIds: ReadonlyArray<AwardTypeId>;

    private constructor(attributes: ClassDefinitionAttributes) {
        this.id = attributes.id;
        this.fromAgeMonths = attributes.fromAgeMonths;
        this.lessThanAgeMonths = attributes.lessThanAgeMonths;
        this.requiredCertificates = [...attributes.requiredCertificates];
        this.bredByExhibitor = attributes.bredByExhibitor;
        this.gradeScaleId = attributes.gradeScaleId;
        this.awardTypeIds = [...attributes.awardTypeIds];
    }

    static of(attributes: ClassDefinitionAttributes): ClassDefinition {
        return new ClassDefinition(attributes);
    }
}
