// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayerId } from '../value-objects/domain-ids.js';
import type { ClassDefinition } from './class-definition.js';
import type { GradeScale } from './grade-scale.js';
import type { AwardType } from './award-type.js';
import type { ShowType } from './show-type.js';

/** Attributes for {@link RulesetLayer.of}. */
export interface RulesetLayerAttributes {
    readonly id: RulesetLayerId;
    /** Parent layer this one extends. Undefined for the FCI base layer. */
    readonly parentLayerId: RulesetLayerId | undefined;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly showTypes: ReadonlyArray<ShowType>;
}

/**
 * A single layer in a composed Ruleset (e.g. FCI base, SRSH national layer).
 * Layers are composed by {@link EffectiveRuleset.resolve} to produce an
 * {@link EffectiveRuleset}.
 *
 * An entity (ADR-0022): private constructor plus the {@link RulesetLayer.of}
 * factory is the only construction path. Identified by `id`, not by value.
 */
export class RulesetLayer {
    readonly id: RulesetLayerId;
    readonly parentLayerId: RulesetLayerId | undefined;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly showTypes: ReadonlyArray<ShowType>;

    private constructor(attributes: RulesetLayerAttributes) {
        this.id = attributes.id;
        this.parentLayerId = attributes.parentLayerId;
        this.classDefinitions = [...attributes.classDefinitions];
        this.gradeScales = [...attributes.gradeScales];
        this.awardTypes = [...attributes.awardTypes];
        this.showTypes = [...attributes.showTypes];
    }

    static of(attributes: RulesetLayerAttributes): RulesetLayer {
        return new RulesetLayer(attributes);
    }
}
