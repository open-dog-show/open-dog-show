// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayerId } from '../value-objects/domain-ids.js';
import type { ClassDefinition } from './class-definition.js';
import type { GradeScale } from './grade-scale.js';
import type { AwardType } from './award-type.js';
import type { ShowType } from './show-type.js';

/**
 * A single layer in a composed Ruleset (e.g. FCI base, SRSH national layer).
 * Layers are composed by resolveEffectiveRuleset to produce an
 * {@link EffectiveRuleset}. This type is internal to the Rulesets context
 * and is intentionally NOT exported from the package's public surface.
 */
export interface RulesetLayer {
    readonly id: RulesetLayerId;
    /** Parent layer this one extends. Undefined for the FCI base layer. */
    readonly parentLayerId: RulesetLayerId | undefined;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly showTypes: ReadonlyArray<ShowType>;
}
