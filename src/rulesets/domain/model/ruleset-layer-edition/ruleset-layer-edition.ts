// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayerId } from '../../shared/domain-ids.js';
import type { LocalDate } from '../effective-ruleset/value-objects/local-date.js';
import type { ClassDefinition } from '../effective-ruleset/entities/class-definition.js';
import type { GradeScale } from '../effective-ruleset/entities/grade-scale.js';
import type { AwardType } from '../effective-ruleset/entities/award-type.js';
import type { ShowType } from '../effective-ruleset/entities/show-type.js';

/** Attributes for {@link RulesetLayerEdition.of}. */
export interface RulesetLayerEditionAttributes {
    readonly layerId: RulesetLayerId;
    /** The calendar date from which this edition's content is in force (ADR-0029). */
    readonly effectiveFrom: LocalDate;
    readonly classDefinitions: readonly ClassDefinition[];
    readonly gradeScales: readonly GradeScale[];
    readonly awardTypes: readonly AwardType[];
    readonly showTypes: readonly ShowType[];
}

/**
 * The complete content of one {@link RulesetLayerId} Ruleset Layer as in
 * force from a stated effective date (ADR-0029; ADR-0001's 2026-09-11
 * amendment). A rule change never edits an edition — it publishes a new
 * edition of the same layer, effective from a stated date.
 *
 * Authored FCI/KMSH content lives behind a {@link RulesetLayerEditionRepository}
 * port in `infrastructure/persistence/bundled/<ruleset>/`, one module per
 * edition (e.g. `fci-2026-01-01.ts`) — this class carries the shape only; the
 * domain core has zero references to any concrete ruleset.
 *
 * An aggregate root (ADR-0022, ADR-0029): it gets its own {@link
 * RulesetLayerEditionRepository}, so it is queried directly rather than only
 * through another aggregate. Private constructor plus the {@link
 * RulesetLayerEdition.of} factory is the only construction path; a private
 * `#brand` field makes the class nominal (mirrors `EffectiveRuleset`/`Item`),
 * so a bare `{ layerId, effectiveFrom, ... }` object literal is not
 * assignable and cannot bypass the factory's defensive array copies.
 * Identified by the natural key `(layerId, effectiveFrom)` — no surrogate id,
 * mirroring ADR-0029's "layer id + effective date".
 */
export class RulesetLayerEdition {
    // Nominal brand: a bare object literal lacks this private field, so it is
    // not assignable to `RulesetLayerEdition` — closes the structural-literal leak.
    // eslint-disable-next-line no-unused-private-class-members -- intentional nominal brand; exists for compile-time type pinning, not runtime use.
    readonly #brand = true;

    readonly layerId: RulesetLayerId;
    readonly effectiveFrom: LocalDate;
    readonly classDefinitions: readonly ClassDefinition[];
    readonly gradeScales: readonly GradeScale[];
    readonly awardTypes: readonly AwardType[];
    readonly showTypes: readonly ShowType[];

    private constructor(attributes: RulesetLayerEditionAttributes) {
        this.layerId = attributes.layerId;
        this.effectiveFrom = attributes.effectiveFrom;
        this.classDefinitions = [...attributes.classDefinitions];
        this.gradeScales = [...attributes.gradeScales];
        this.awardTypes = [...attributes.awardTypes];
        this.showTypes = [...attributes.showTypes];
    }

    static of(attributes: RulesetLayerEditionAttributes): RulesetLayerEdition {
        return new RulesetLayerEdition(attributes);
    }

    /**
     * The latest of `editions` for `layerId` effective on or before `date`,
     * or `undefined` when none qualifies (ADR-0029: "for each of the
     * Ruleset's ordered layers, resolution takes the latest edition
     * effective on or before the show date"). Shared by every {@link
     * RulesetLayerEditionRepository} implementation so the "latest,
     * on-or-before" comparison is written once rather than per adapter.
     */
    static latestInForce(
        editions: readonly RulesetLayerEdition[],
        layerId: RulesetLayerId,
        date: LocalDate,
    ): RulesetLayerEdition | undefined {
        let latest: RulesetLayerEdition | undefined;
        for (const edition of editions) {
            if (edition.layerId !== layerId) continue;
            if (!edition.effectiveFrom.isOnOrBefore(date)) continue;
            if (latest === undefined || latest.effectiveFrom.isOnOrBefore(edition.effectiveFrom)) {
                latest = edition;
            }
        }
        return latest;
    }
}

/**
 * A reference to the {@link RulesetLayerEdition} an {@link EffectiveRuleset}
 * composed one of its layers from — the shape `EffectiveRuleset.sourceEditions`
 * records (ADR-0029: "the snapshot records which editions were used").
 */
export interface RulesetLayerEditionReference {
    readonly layerId: RulesetLayerId;
    readonly effectiveFrom: LocalDate;
}
