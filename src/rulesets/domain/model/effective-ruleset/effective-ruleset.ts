// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, ClassId, GradeId, GradeScaleId } from './value-objects/domain-ids.js';
import type { LocalDate } from './value-objects/local-date.js';
import type { ClassDefinition } from './entities/class-definition.js';
import type { Grade, GradeScale } from './entities/grade-scale.js';
import type { AwardType, HigherScopeAwardType } from './entities/award-type.js';
import type { ShowType } from './entities/show-type.js';
import type { RulesetLayerId } from './value-objects/domain-ids.js';

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

/**
 * Lookup helpers for {@link EffectiveRuleset}. The ruleset is a bare data bag;
 * these centralise the by-id lookups so consumers (the FCI policies, grade
 * comparison) stop re-implementing linear `find` walks and the
 * "individual award in this scope" filter.
 */

/** Returns the {@link AwardType} with `id`, or `undefined` when absent. */
export function findAwardType(ruleset: EffectiveRuleset, id: AwardTypeId): AwardType | undefined {
    return ruleset.awardTypes.find((at) => at.id === id);
}

/** Returns the {@link ClassDefinition} with `id`, or `undefined` when absent. */
export function findClassDefinition(
    ruleset: EffectiveRuleset,
    id: ClassId,
): ClassDefinition | undefined {
    return ruleset.classDefinitions.find((c) => c.id === id);
}

/** Returns the {@link Grade} for `gradeId` on scale `scaleId`, or `undefined`. */
export function findGrade(
    ruleset: EffectiveRuleset,
    scaleId: GradeScaleId,
    gradeId: GradeId,
): Grade | undefined {
    return ruleset.gradeScales
        .find((gs) => gs.id === scaleId)
        ?.grades.find((g) => g.id === gradeId);
}

/**
 * The higher-scope (breed/group/show) {@link HigherScopeAwardType}s whose scope
 * matches `scopeKind` — the "individual award in this scope" filter that the
 * FCI policy previously re-implemented inline in both `higherScopeEligible` and
 * `requireNonDiscretionaryAwards`.
 */
export function higherScopeAwardTypesForScope(
    ruleset: EffectiveRuleset,
    scopeKind: 'breed' | 'group' | 'show',
): ReadonlyArray<HigherScopeAwardType> {
    return ruleset.awardTypes.filter((at): at is HigherScopeAwardType => at.scope === scopeKind);
}
