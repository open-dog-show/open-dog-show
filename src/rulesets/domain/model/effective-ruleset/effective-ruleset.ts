// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, ClassId, GradeId, GradeScaleId } from './value-objects/domain-ids.js';
import type { LocalDate } from './value-objects/local-date.js';
import type { ClassDefinition } from './entities/class-definition.js';
import type { Grade, GradeScale } from './entities/grade-scale.js';
import type { AwardType, HigherScopeAwardType } from './entities/award-type.js';
import type { ShowType } from './entities/show-type.js';
import type { RulesetLayer } from './entities/ruleset-layer.js';
import type { RulesetLayerId } from './value-objects/domain-ids.js';

/**
 * The resolved, versioned snapshot of composed {@link RulesetLayer}s that a
 * Show is judged under. Pinned to the Show at setup so results are immune to
 * later Ruleset edits. The domain core operates only on the EffectiveRuleset.
 *
 * The aggregate root of the rulesets domain (ADR-0022): private constructor
 * plus the {@link EffectiveRuleset.resolve} factory — which composes an
 * ordered array of {@link RulesetLayer}s (last layer wins, wholesale
 * replacement per item id) — is the only construction path; a private
 * `#brand` field makes the class nominal (mirrors `RoleGrant`). The snapshot
 * is immutable once resolved, so — unlike `RoleGrant`/`User`/`Entry` — it has
 * no instance mutators; {@link resolve} is its only behaviour.
 */
export class EffectiveRuleset {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `EffectiveRuleset` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    /** The calendar date on which the layers were composed into this snapshot. */
    readonly resolvedAt: LocalDate;
    /** Ordered list of source layer IDs — the last entry has the highest precedence. */
    readonly sourceLayerIds: ReadonlyArray<RulesetLayerId>;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly showTypes: ReadonlyArray<ShowType>;

    private constructor(attributes: {
        readonly resolvedAt: LocalDate;
        readonly sourceLayerIds: ReadonlyArray<RulesetLayerId>;
        readonly classDefinitions: ReadonlyArray<ClassDefinition>;
        readonly gradeScales: ReadonlyArray<GradeScale>;
        readonly awardTypes: ReadonlyArray<AwardType>;
        readonly showTypes: ReadonlyArray<ShowType>;
    }) {
        this.resolvedAt = attributes.resolvedAt;
        this.sourceLayerIds = attributes.sourceLayerIds;
        this.classDefinitions = attributes.classDefinitions;
        this.gradeScales = attributes.gradeScales;
        this.awardTypes = attributes.awardTypes;
        this.showTypes = attributes.showTypes;
    }

    /**
     * Composes an ordered array of {@link RulesetLayer}s into a single
     * immutable {@link EffectiveRuleset} snapshot.
     *
     * Merge rules:
     * - Items are identified by their `id` field.
     * - The last layer in the array wins when two layers share an item ID
     *   (wholesale replacement — no field-level merging).
     * - Items not overridden by a later layer are preserved as-is.
     * - The returned snapshot detaches the collections from their inputs (new
     *   arrays); individual item references are preserved, not structurally cloned.
     *
     * @param layers    Ordered layers, base first (e.g. [fciLayer, srshLayer]).
     * @param resolvedAt Calendar date of resolution, supplied by the caller to
     *                  keep this factory pure and deterministic in tests.
     */
    static resolve(layers: ReadonlyArray<RulesetLayer>, resolvedAt: LocalDate): EffectiveRuleset {
        return new EffectiveRuleset({
            // LocalDate is an immutable value object — its reference is safe to
            // share, so the snapshot preserves it directly (no defensive copy).
            resolvedAt,
            sourceLayerIds: layers.map((l) => l.id),
            classDefinitions: mergeById(layers.flatMap((l) => [...l.classDefinitions])),
            gradeScales: mergeById(layers.flatMap((l) => [...l.gradeScales])),
            awardTypes: mergeById(layers.flatMap((l) => [...l.awardTypes])),
            showTypes: mergeById(layers.flatMap((l) => [...l.showTypes])),
        });
    }
}

/**
 * Returns a new array deduplicated by `id`, last occurrence wins.
 * Each item reference is preserved (shallow copy of the collection, not a
 * structural deep clone of each item).
 */
function mergeById<T extends { readonly id: string }>(items: ReadonlyArray<T>): ReadonlyArray<T> {
    const map = new Map<string, T>();
    for (const item of items) {
        map.set(item.id, item);
    }
    return [...map.values()];
}

/**
 * Lookup helpers for {@link EffectiveRuleset}. The ruleset is an immutable
 * snapshot; these centralise the by-id lookups so consumers (the FCI
 * policies, grade comparison) stop re-implementing linear `find` walks and
 * the "individual award in this scope" filter.
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
