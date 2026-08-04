// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayerId } from './domain-ids.js';
import type { LocalDate } from './local-date.js';
import type { ClassDefinition } from './class-definition.js';
import type { GradeScale } from './grade-scale.js';
import type { AwardType } from './award-type.js';
import type { ShowType } from './show-type.js';

/**
 * The resolved, versioned snapshot of composed {@link RulesetLayer}s that a
 * Show is judged under. Pinned to the Show at setup so results are immune to
 * later Ruleset edits. The domain core operates only on the EffectiveRuleset.
 */
export interface EffectiveRuleset {
    /** The calendar date on which the layers were composed into this snapshot. */
    readonly resolvedAt: LocalDate;
    /** Ordered list of source layer IDs — the last entry has the highest precedence. */
    readonly sourceLayerIds: ReadonlyArray<RulesetLayerId>;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly showTypes: ReadonlyArray<ShowType>;
}
