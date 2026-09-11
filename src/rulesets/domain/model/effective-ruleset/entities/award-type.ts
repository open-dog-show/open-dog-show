// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AwardTypeId, ClassId, GradeId } from '../value-objects/domain-ids.js';
import type { Placement } from '../value-objects/placement.js';
import { DomainError } from '../../../../../Shared/domain/domain-error.js';

/** The scope level at which an {@link AwardType} is determined. */
export type AwardScope = 'per-sex' | 'breed' | 'group' | 'show' | 'collective';

/**
 * An **Award Feeder** — an {@link AwardType} (e.g. CACIB feeds BOB; BIG feeds
 * BIS) that qualifies a Dog as a candidate for a higher-scope Award
 * (ADR-0017).
 *
 * A value object (ADR-0022): a **variant value object** — {@link
 * AwardFeeder} and {@link ClassFeeder} carry different fields (`awardTypeId`
 * vs `classId`), so each is its own class rather than a single class with
 * optional fields (mirrors `TransactionScope`, ADR-0023). Private
 * constructor plus the {@link AwardFeeder.of} factory is the only
 * construction path.
 */
export class AwardFeeder {
    readonly kind = 'award' as const;
    readonly awardTypeId: AwardTypeId;

    private constructor(awardTypeId: AwardTypeId) {
        this.awardTypeId = awardTypeId;
    }

    static of(awardTypeId: AwardTypeId): AwardFeeder {
        return new AwardFeeder(awardTypeId);
    }

    equals(other: AwardFeeder): boolean {
        return this.awardTypeId === other.awardTypeId;
    }
}

/**
 * A **Class Feeder** — a Class placement (e.g. the Puppy class 1st feeds Best
 * Puppy in Show) that qualifies a Dog as a candidate for a higher-scope
 * Award (ADR-0017). See {@link AwardFeeder} for the variant-value-object
 * rationale.
 */
export class ClassFeeder {
    readonly kind = 'class' as const;
    readonly classId: ClassId;

    private constructor(classId: ClassId) {
        this.classId = classId;
    }

    static of(classId: ClassId): ClassFeeder {
        return new ClassFeeder(classId);
    }

    equals(other: ClassFeeder): boolean {
        return this.classId === other.classId;
    }
}

/**
 * A feeder — the award-or-class source that qualifies a Dog as a candidate
 * for a higher-scope Award (ADR-0017). Either an {@link AwardFeeder} or a
 * {@link ClassFeeder}. Authored per Ruleset Layer (last layer wins,
 * wholesale replacement).
 */
export type Feeder = AwardFeeder | ClassFeeder;

/** Attributes for {@link PerSexAwardType.of}. */
export interface PerSexAwardTypeAttributes {
    readonly id: AwardTypeId;
    /** Minimum Grade a Dog must receive to be eligible for this Award. */
    readonly minimumGradeId: GradeId;
    /**
     * Worst ordinal placement still eligible for this award (1 = best, 2 =
     * second, …). `undefined` when no placement restriction applies. A dog
     * placed worse than this ordinal is not eligible.
     */
    readonly worstEligiblePlacement: Placement | undefined;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
}

/**
 * An individual-dog award type determined at the per-sex (class) judging
 * level. Per-sex awards are fed by their Class (via
 * `ClassDefinition.awardTypeIds`), not by other awards, so they carry no
 * `fedBy`.
 *
 * A value object (ADR-0022): a **variant value object** — {@link
 * PerSexAwardType}, {@link HigherScopeAwardType}, and {@link
 * CollectiveAwardType} carry genuinely different fields, so each is its own
 * class. `scope` is fixed to `'per-sex'` by the {@link PerSexAwardType.of}
 * factory (mirrors `ClubTransactionScope`, ADR-0023) rather than accepted as
 * a parameter.
 */
export class PerSexAwardType {
    readonly scope = 'per-sex' as const;
    readonly id: AwardTypeId;
    readonly minimumGradeId: GradeId;
    readonly worstEligiblePlacement: Placement | undefined;
    readonly isDiscretionary: boolean;

    private constructor(attributes: PerSexAwardTypeAttributes) {
        this.id = attributes.id;
        this.minimumGradeId = attributes.minimumGradeId;
        this.worstEligiblePlacement = attributes.worstEligiblePlacement;
        this.isDiscretionary = attributes.isDiscretionary;
    }

    static of(attributes: PerSexAwardTypeAttributes): PerSexAwardType {
        return new PerSexAwardType(attributes);
    }
}

/**
 * Thrown by {@link HigherScopeAwardType.breed} / {@link
 * HigherScopeAwardType.group} / {@link HigherScopeAwardType.show} when
 * `fedBy` is empty. A higher-scope award with no feeder can never be
 * eligible — {@link FciAwardPolicy} already treats this as malformed at
 * evaluation time; the constructor now refuses it at construction instead
 * (V2).
 */
export class EmptyFeederListError extends DomainError {
    readonly awardTypeId: AwardTypeId;

    constructor(awardTypeId: AwardTypeId) {
        super(`Higher-scope award type '${awardTypeId}' declares no feeders`, { awardTypeId });
        this.awardTypeId = awardTypeId;
    }
}

/** Attributes for {@link HigherScopeAwardType.breed} / {@link HigherScopeAwardType.group} / {@link HigherScopeAwardType.show} — the scope aside. */
export interface HigherScopeAwardTypeAttributes {
    readonly id: AwardTypeId;
    /** Minimum Grade a Dog must receive to be eligible for this Award. */
    readonly minimumGradeId: GradeId;
    /**
     * Worst ordinal placement still eligible (1 = best). `undefined` when no
     * placement restriction applies; higher-scope awards are usually
     * grade-gated only, so this is typically `undefined`.
     */
    readonly worstEligiblePlacement: Placement | undefined;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
    /**
     * The {@link Feeder}s that supply candidates for this higher-scope Award
     * (ADR-0017). A multi-feeder (e.g. BOB draws on CACIB + junior/veteran
     * class wins) is a multi-element array; a single feeder is a one-element
     * array. Always defined for higher-scope awards.
     */
    readonly fedBy: ReadonlyArray<Feeder>;
}

/**
 * An individual-dog award type determined at a higher scope (breed/group/show).
 * Higher-scope awards are fed by other awards and/or class placements, so they
 * always declare a non-empty `fedBy` (its *presence* on higher-scope awards is
 * the type guarantee — `PerSexAwardType` has no `fedBy` field; non-emptiness
 * is a construction-time invariant enforced by the constructor, which throws
 * {@link EmptyFeederListError} for an empty list).
 *
 * The three higher-scope levels share this one shape (only `scope` differs)
 * — per the harness "same shape, multiple factories" rule (mirrors {@link
 * HigherScopeJudgingScopeResults}) — so `scope` is fixed by the named factory
 * chosen ({@link HigherScopeAwardType.breed} / {@link
 * HigherScopeAwardType.group} / {@link HigherScopeAwardType.show}) rather
 * than accepted as caller data.
 */
export class HigherScopeAwardType {
    readonly id: AwardTypeId;
    readonly minimumGradeId: GradeId;
    readonly worstEligiblePlacement: Placement | undefined;
    readonly isDiscretionary: boolean;
    readonly scope: 'breed' | 'group' | 'show';
    readonly fedBy: ReadonlyArray<Feeder>;

    private constructor(
        scope: 'breed' | 'group' | 'show',
        attributes: HigherScopeAwardTypeAttributes,
    ) {
        if (attributes.fedBy.length === 0) {
            throw new EmptyFeederListError(attributes.id);
        }
        this.id = attributes.id;
        this.minimumGradeId = attributes.minimumGradeId;
        this.worstEligiblePlacement = attributes.worstEligiblePlacement;
        this.isDiscretionary = attributes.isDiscretionary;
        this.scope = scope;
        this.fedBy = [...attributes.fedBy];
    }

    static breed(attributes: HigherScopeAwardTypeAttributes): HigherScopeAwardType {
        return new HigherScopeAwardType('breed', attributes);
    }

    static group(attributes: HigherScopeAwardTypeAttributes): HigherScopeAwardType {
        return new HigherScopeAwardType('group', attributes);
    }

    static show(attributes: HigherScopeAwardTypeAttributes): HigherScopeAwardType {
        return new HigherScopeAwardType('show', attributes);
    }
}

/** An individual-dog award type: per-sex or higher-scope (breed/group/show). */
export type IndividualAwardType = PerSexAwardType | HigherScopeAwardType;

/** Attributes for {@link CollectiveAwardType.of}. */
export interface CollectiveAwardTypeAttributes {
    readonly id: AwardTypeId;
    /** True if the award is at the judge's discretion and need not be given. */
    readonly isDiscretionary: boolean;
}

/**
 * A collective-competition award type (Brace/Couple, Breeders' Group,
 * Progeny Group). Has no grade or placement requirement -- structural
 * validity is governed by {@link CollectiveAwardPolicy}. `scope` is fixed to
 * `'collective'` by the {@link CollectiveAwardType.of} factory.
 */
export class CollectiveAwardType {
    readonly scope = 'collective' as const;
    readonly id: AwardTypeId;
    readonly isDiscretionary: boolean;

    private constructor(attributes: CollectiveAwardTypeAttributes) {
        this.id = attributes.id;
        this.isDiscretionary = attributes.isDiscretionary;
    }

    static of(attributes: CollectiveAwardTypeAttributes): CollectiveAwardType {
        return new CollectiveAwardType(attributes);
    }
}

/**
 * The ruleset-owned definition of a single honour that can be proposed
 * in a judging unit -- e.g. CAC, CACIB, Best of Breed, Best Brace.
 */
export type AwardType = IndividualAwardType | CollectiveAwardType;
