// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClassDefinition } from './class-definition.js';
import type { GradeScale } from './grade-scale.js';
import type { AwardType } from './award-type.js';
import type { Breed, Variety, Group } from './breed.js';
import type { ShowType } from './show-type.js';

/**
 * The resolved, versioned snapshot of composed {@link RulesetLayer}s that a
 * Show is judged under. Pinned to the Show at setup so results are immune to
 * later Ruleset edits. The domain core operates only on the EffectiveRuleset.
 */
export interface EffectiveRuleset {
    /** Unique identifier for this snapshot. */
    readonly id: string;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly breeds: ReadonlyArray<Breed>;
    readonly varieties: ReadonlyArray<Variety>;
    readonly groups: ReadonlyArray<Group>;
    readonly showTypes: ReadonlyArray<ShowType>;
}
