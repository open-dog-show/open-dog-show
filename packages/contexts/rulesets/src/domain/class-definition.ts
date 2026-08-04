// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassId, GradeScaleId, AwardTypeId } from './domain-ids.js';
import type { CertificateKind } from './certificate-kind.js';

/**
 * The ruleset-owned data record for a single Class — eligibility rules,
 * the {@link GradeScale} used, and the {@link AwardType}s the class feeds.
 *
 * Age is evaluated on the show day; a Dog that reaches an age boundary
 * on show day moves to the higher class (FCI 2026; KMSH ART.23).
 */
export interface ClassDefinition {
    readonly id: ClassId;
    readonly name: string;
    /** Minimum age in whole days on show day. Undefined = no lower bound. */
    readonly minAgeDays: number | undefined;
    /** Maximum age in whole days on show day. Undefined = no upper bound. */
    readonly maxAgeDays: number | undefined;
    /** Entry certificates required to enter this Class. */
    readonly requiredCertificates: ReadonlyArray<CertificateKind>;
    /** Whether the Bred-by-Exhibitor handler condition applies. */
    readonly bredByExhibitor: boolean;
    readonly gradeScaleId: GradeScaleId;
    /** AwardTypes that Dogs in this Class are eligible to feed. */
    readonly awardTypeIds: ReadonlyArray<AwardTypeId>;
}
