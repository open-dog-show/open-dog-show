// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
    AwardTypeId,
    ClassId,
    EffectiveRulesetId,
    GradeId,
    GradeScaleId,
} from './value-objects/domain-ids.js';
import type { LocalDate } from './value-objects/local-date.js';
import type { ClassDefinition } from './entities/class-definition.js';
import type { GradeScale } from './entities/grade-scale.js';
import type { AwardType, Feeder, HigherScopeAwardType } from './entities/award-type.js';
import type { ShowType } from './entities/show-type.js';
import type { RulesetLayer } from './entities/ruleset-layer.js';
import type { RulesetLayerId } from './value-objects/domain-ids.js';
import { DomainError } from '../../../../Shared/domain/domain-error.js';

/**
 * Thrown by {@link EffectiveRuleset.resolve} when a {@link ClassDefinition}'s
 * `gradeScaleId` does not resolve to any {@link GradeScale} in the composed
 * snapshot.
 */
export class UnknownGradeScaleReferenceError extends DomainError {
    readonly classId: ClassId;
    readonly gradeScaleId: GradeScaleId;

    constructor(classId: ClassId, gradeScaleId: GradeScaleId) {
        super(`Class '${classId}' references unknown grade scale '${gradeScaleId}'`, {
            classId,
            gradeScaleId,
        });
        this.classId = classId;
        this.gradeScaleId = gradeScaleId;
    }
}

/**
 * Thrown by {@link EffectiveRuleset.resolve} when a {@link ClassDefinition}'s
 * `awardTypeIds` contains an id that does not resolve to any {@link
 * AwardType} in the composed snapshot.
 */
export class UnknownAwardTypeReferenceError extends DomainError {
    readonly classId: ClassId;
    readonly awardTypeId: AwardTypeId;

    constructor(classId: ClassId, awardTypeId: AwardTypeId) {
        super(`Class '${classId}' references unknown award type '${awardTypeId}'`, {
            classId,
            awardTypeId,
        });
        this.classId = classId;
        this.awardTypeId = awardTypeId;
    }
}

/**
 * Thrown by {@link EffectiveRuleset.resolve} when an {@link IndividualAwardType}
 * has a `minimumGradeId` that does not resolve on any grade scale it is used
 * with: for a per-sex award type, the scale of each Class whose
 * `awardTypeIds` names it; for a higher-scope award type, the scale of every
 * Class reachable by following its `fedBy` feeder graph down to concrete
 * Class feeders (recursing through award feeders).
 */
export class UnknownMinimumGradeReferenceError extends DomainError {
    readonly awardTypeId: AwardTypeId;
    readonly gradeScaleIds: ReadonlyArray<GradeScaleId>;
    readonly minimumGradeId: GradeId;

    constructor(
        awardTypeId: AwardTypeId,
        minimumGradeId: GradeId,
        gradeScaleIds: ReadonlyArray<GradeScaleId>,
    ) {
        super(
            `Award type '${awardTypeId}' minimum grade '${minimumGradeId}' does not resolve on any grade scale it is used with (checked: ${gradeScaleIds.join(', ')})`,
            { awardTypeId, minimumGradeId, gradeScaleIds },
        );
        this.awardTypeId = awardTypeId;
        this.minimumGradeId = minimumGradeId;
        this.gradeScaleIds = gradeScaleIds;
    }
}

/**
 * The resolved, immutable, identified snapshot of composed {@link
 * RulesetLayer}s that a Show is judged under. Pinned to the Show at setup so
 * results are immune to later Ruleset edits — the `id` is the pin; there is
 * no separate version field (ADR-0029). The domain core operates only on the
 * EffectiveRuleset.
 *
 * The aggregate root of the rulesets domain (ADR-0022): private constructor
 * plus the {@link EffectiveRuleset.resolve} factory — which composes an
 * ordered array of {@link RulesetLayer}s (last layer wins, wholesale
 * replacement per item id) — is the only construction path; a private
 * `#brand` field makes the class nominal (mirrors `RoleGrant`). The snapshot
 * is immutable once resolved, so — unlike `RoleGrant`/`User`/`Entry` — it has
 * no instance mutators.
 *
 * **Resolution is the validating factory (ADR-0029).** So consumers never
 * re-check them, three cross-references are validated as the snapshot is
 * composed: every {@link ClassDefinition.gradeScaleId} resolves to a {@link
 * GradeScale} ({@link UnknownGradeScaleReferenceError}); every id in {@link
 * ClassDefinition.awardTypeIds} resolves to an {@link AwardType} ({@link
 * UnknownAwardTypeReferenceError}); and every award type's `minimumGradeId`
 * resolves on every grade scale it is used with ({@link
 * UnknownMinimumGradeReferenceError}) — for a per-sex award type, the scale
 * of each Class naming it directly; for a higher-scope award type, the
 * scale of every Class reachable by following its `fedBy` feeder graph. A
 * {@link GradeScale}'s own `placeableThresholdId` ∈ `grades` invariant is
 * enforced by {@link GradeScale.of} itself, not re-checked here.
 * `ShowType.availableAwardTypeIds` and a dangling `HigherScopeAwardType.fedBy`
 * reference are not cross-checked against this snapshot's own catalog — out
 * of scope for this pass.
 */
export class EffectiveRuleset {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `EffectiveRuleset` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly id: EffectiveRulesetId;
    /** The calendar date these rules are in force for (the Show's date). */
    readonly resolvedFor: LocalDate;
    /** Ordered list of source layer IDs — the last entry has the highest precedence. */
    readonly sourceLayerIds: ReadonlyArray<RulesetLayerId>;
    readonly classDefinitions: ReadonlyArray<ClassDefinition>;
    readonly gradeScales: ReadonlyArray<GradeScale>;
    readonly awardTypes: ReadonlyArray<AwardType>;
    readonly showTypes: ReadonlyArray<ShowType>;

    private constructor(attributes: {
        readonly id: EffectiveRulesetId;
        readonly resolvedFor: LocalDate;
        readonly sourceLayerIds: ReadonlyArray<RulesetLayerId>;
        readonly classDefinitions: ReadonlyArray<ClassDefinition>;
        readonly gradeScales: ReadonlyArray<GradeScale>;
        readonly awardTypes: ReadonlyArray<AwardType>;
        readonly showTypes: ReadonlyArray<ShowType>;
    }) {
        this.id = attributes.id;
        this.resolvedFor = attributes.resolvedFor;
        this.sourceLayerIds = attributes.sourceLayerIds;
        this.classDefinitions = attributes.classDefinitions;
        this.gradeScales = attributes.gradeScales;
        this.awardTypes = attributes.awardTypes;
        this.showTypes = attributes.showTypes;
    }

    /**
     * Composes an ordered array of {@link RulesetLayer}s into a single
     * immutable, identified {@link EffectiveRuleset} snapshot, validating
     * every cross-reference in the result (see class docs).
     *
     * Merge rules:
     * - Items are identified by their `id` field.
     * - The last layer in the array wins when two layers share an item ID
     *   (wholesale replacement — no field-level merging).
     * - Items not overridden by a later layer are preserved as-is.
     * - The returned snapshot detaches the collections from their inputs (new
     *   arrays); individual item references are preserved, not structurally cloned.
     *
     * @param id         The identity to pin this snapshot under (ADR-0029).
     * @param layers     Ordered layers, base first (e.g. [fciLayer, srshLayer]).
     * @param resolvedFor Calendar date these rules are in force for (the
     *                   Show's date), supplied by the caller to keep this
     *                   factory pure and deterministic in tests.
     */
    static resolve(
        id: EffectiveRulesetId,
        layers: ReadonlyArray<RulesetLayer>,
        resolvedFor: LocalDate,
    ): EffectiveRuleset {
        const classDefinitions = mergeById(layers.flatMap((l) => [...l.classDefinitions]));
        const gradeScales = mergeById(layers.flatMap((l) => [...l.gradeScales]));
        const awardTypes = mergeById(layers.flatMap((l) => [...l.awardTypes]));
        const showTypes = mergeById(layers.flatMap((l) => [...l.showTypes]));

        validateReferences(classDefinitions, gradeScales, awardTypes);

        return new EffectiveRuleset({
            id,
            // LocalDate is an immutable value object — its reference is safe to
            // share, so the snapshot preserves it directly (no defensive copy).
            resolvedFor,
            sourceLayerIds: layers.map((l) => l.id),
            classDefinitions,
            gradeScales,
            awardTypes,
            showTypes,
        });
    }

    /** Returns the {@link AwardType} with `id`, or `undefined` when absent. */
    awardType(id: AwardTypeId): AwardType | undefined {
        return this.awardTypes.find((at) => at.id === id);
    }

    /** Returns the {@link ClassDefinition} with `id`, or `undefined` when absent. */
    classDefinition(id: ClassId): ClassDefinition | undefined {
        return this.classDefinitions.find((c) => c.id === id);
    }

    /** Returns the {@link GradeScale} with `id`, or `undefined` when absent. */
    gradeScale(id: GradeScaleId): GradeScale | undefined {
        return this.gradeScales.find((gs) => gs.id === id);
    }

    /**
     * The higher-scope (breed/group/show) {@link HigherScopeAwardType}s whose
     * scope matches `scopeKind` — the "individual award in this scope" filter
     * that the FCI policy previously re-implemented inline in both
     * `higherScopeEligible` and `requireNonDiscretionaryAwards`.
     */
    higherScopeAwardTypes(
        scopeKind: 'breed' | 'group' | 'show',
    ): ReadonlyArray<HigherScopeAwardType> {
        return this.awardTypes.filter((at): at is HigherScopeAwardType => at.scope === scopeKind);
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
 * Validates every cross-reference in a composed snapshot (ADR-0029): each
 * Class's `gradeScaleId` and `awardTypeIds` resolve, each award type
 * reachable from a Class's `awardTypeIds` has its `minimumGradeId` resolve
 * on that Class's scale, and every higher-scope award type's
 * `minimumGradeId` resolves on every scale reachable through its `fedBy`
 * feeder graph.
 */
function validateReferences(
    classDefinitions: ReadonlyArray<ClassDefinition>,
    gradeScales: ReadonlyArray<GradeScale>,
    awardTypes: ReadonlyArray<AwardType>,
): void {
    const scaleById = new Map(gradeScales.map((gs) => [gs.id, gs]));
    const awardById = new Map(awardTypes.map((at) => [at.id, at]));

    for (const classDef of classDefinitions) {
        const scale = resolveClassGradeScale(classDef, scaleById);
        for (const awardTypeId of classDef.awardTypeIds) {
            validateAwardTypeReference(classDef, awardTypeId, scale, awardById);
        }
    }

    validateHigherScopeMinimumGrades(classDefinitions, scaleById, awardById);
}

/** Resolves `classDef.gradeScaleId`, or throws {@link UnknownGradeScaleReferenceError}. */
function resolveClassGradeScale(
    classDef: ClassDefinition,
    scaleById: ReadonlyMap<GradeScaleId, GradeScale>,
): GradeScale {
    const scale = scaleById.get(classDef.gradeScaleId);
    if (scale === undefined) {
        throw new UnknownGradeScaleReferenceError(classDef.id, classDef.gradeScaleId);
    }
    return scale;
}

/**
 * Validates one of `classDef`'s `awardTypeIds`: the id resolves to an {@link
 * AwardType} ({@link UnknownAwardTypeReferenceError}), and — when that award
 * type carries a `minimumGradeId` — it resolves on `scale` ({@link
 * UnknownMinimumGradeReferenceError}).
 */
function validateAwardTypeReference(
    classDef: ClassDefinition,
    awardTypeId: AwardTypeId,
    scale: GradeScale,
    awardById: ReadonlyMap<AwardTypeId, AwardType>,
): void {
    const awardType = awardById.get(awardTypeId);
    if (awardType === undefined) {
        throw new UnknownAwardTypeReferenceError(classDef.id, awardTypeId);
    }
    if ('minimumGradeId' in awardType && scale.grade(awardType.minimumGradeId) === undefined) {
        throw new UnknownMinimumGradeReferenceError(awardType.id, awardType.minimumGradeId, [
            scale.id,
        ]);
    }
}

function isHigherScopeAwardType(awardType: AwardType): awardType is HigherScopeAwardType {
    return awardType.scope === 'breed' || awardType.scope === 'group' || awardType.scope === 'show';
}

/**
 * Validates every higher-scope award type's `minimumGradeId` against every
 * grade scale reachable through its `fedBy` feeder graph ({@link
 * UnknownMinimumGradeReferenceError} when it resolves on none of them). A
 * higher-scope award with no reachable scale — its feeder graph never
 * bottoms out at a Class — has nothing to check against and is skipped;
 * `HigherScopeAwardType.fedBy` referencing an unknown award type is not
 * itself validated here (out of scope for this pass).
 */
function validateHigherScopeMinimumGrades(
    classDefinitions: ReadonlyArray<ClassDefinition>,
    scaleById: ReadonlyMap<GradeScaleId, GradeScale>,
    awardById: ReadonlyMap<AwardTypeId, AwardType>,
): void {
    const classesByAwardTypeId = new Map<AwardTypeId, ClassDefinition[]>();
    for (const classDef of classDefinitions) {
        for (const awardTypeId of classDef.awardTypeIds) {
            const classes = classesByAwardTypeId.get(awardTypeId);
            if (classes === undefined) {
                classesByAwardTypeId.set(awardTypeId, [classDef]);
            } else {
                classes.push(classDef);
            }
        }
    }
    const classById = new Map(classDefinitions.map((c) => [c.id, c]));

    for (const awardType of awardById.values()) {
        if (!isHigherScopeAwardType(awardType)) continue;

        const reachableScaleIds = reachableGradeScaleIds(
            awardType,
            classesByAwardTypeId,
            classById,
            awardById,
            new Set(),
        );
        if (reachableScaleIds.size === 0) continue;

        const resolves = [...reachableScaleIds].some(
            (scaleId) => scaleById.get(scaleId)?.grade(awardType.minimumGradeId) !== undefined,
        );
        if (!resolves) {
            throw new UnknownMinimumGradeReferenceError(awardType.id, awardType.minimumGradeId, [
                ...reachableScaleIds,
            ]);
        }
    }
}

/**
 * The grade-scale ids reachable by following `award`'s `fedBy` feeder graph
 * down to the Classes that ultimately feed it: a {@link ClassFeeder}
 * contributes its Class's scale directly; an {@link AwardFeeder} contributes
 * the scales of Classes naming that award directly (when it's per-sex) and,
 * when it in turn is itself higher-scope, recurses into its own `fedBy`.
 * `visiting` guards against a cycle in the feeder graph.
 */
function reachableGradeScaleIds(
    award: HigherScopeAwardType,
    classesByAwardTypeId: ReadonlyMap<AwardTypeId, ReadonlyArray<ClassDefinition>>,
    classById: ReadonlyMap<ClassId, ClassDefinition>,
    awardById: ReadonlyMap<AwardTypeId, AwardType>,
    visiting: Set<AwardTypeId>,
): Set<GradeScaleId> {
    const scaleIds = new Set<GradeScaleId>();
    if (visiting.has(award.id)) return scaleIds;
    visiting.add(award.id);

    for (const feeder of award.fedBy) {
        addReachableGradeScaleIds(
            feeder,
            classesByAwardTypeId,
            classById,
            awardById,
            visiting,
            scaleIds,
        );
    }
    return scaleIds;
}

/** One `fedBy` entry's contribution to `scaleIds` — see {@link reachableGradeScaleIds}. */
function addReachableGradeScaleIds(
    feeder: Feeder,
    classesByAwardTypeId: ReadonlyMap<AwardTypeId, ReadonlyArray<ClassDefinition>>,
    classById: ReadonlyMap<ClassId, ClassDefinition>,
    awardById: ReadonlyMap<AwardTypeId, AwardType>,
    visiting: Set<AwardTypeId>,
    scaleIds: Set<GradeScaleId>,
): void {
    if (feeder.kind === 'class') {
        const classDef = classById.get(feeder.classId);
        if (classDef !== undefined) scaleIds.add(classDef.gradeScaleId);
        return;
    }

    for (const classDef of classesByAwardTypeId.get(feeder.awardTypeId) ?? []) {
        scaleIds.add(classDef.gradeScaleId);
    }
    const fedAward = awardById.get(feeder.awardTypeId);
    if (fedAward !== undefined && isHigherScopeAwardType(fedAward)) {
        for (const id of reachableGradeScaleIds(
            fedAward,
            classesByAwardTypeId,
            classById,
            awardById,
            visiting,
        )) {
            scaleIds.add(id);
        }
    }
}
