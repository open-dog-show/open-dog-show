// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { BreedId, VarietyId } from '../../shared/domain-ids.js';

/**
 * A breed (and optional variety) pair — the shared breed/variety identity that
 * several collective competitions require participants to share. Bundled as one
 * value object so the `(breedId, varietyId)` pair travels together and a
 * caller cannot pass one without the other.
 *
 * A value object (ADR-0022): private constructor plus the {@link
 * BreedVarietyRef.of} validating factory is the only construction path
 * (V2/V3). The fields carry no independent invariant of their own, so the
 * factory is a pass-through (mirrors {@link RoleScope}).
 */
export class BreedVarietyRef {
    readonly breedId: BreedId;
    readonly varietyId: VarietyId | undefined;

    private constructor(breedId: BreedId, varietyId: VarietyId | undefined) {
        this.breedId = breedId;
        this.varietyId = varietyId;
    }

    static of(breedId: BreedId, varietyId: VarietyId | undefined): BreedVarietyRef {
        return new BreedVarietyRef(breedId, varietyId);
    }

    equals(other: BreedVarietyRef): boolean {
        return this.breedId === other.breedId && this.varietyId === other.varietyId;
    }
}
