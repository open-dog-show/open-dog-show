// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayer } from '../entities/ruleset-layer.js';
import type { EffectiveRuleset } from '../aggregates/effective-ruleset.js';
import type { LocalDate } from '../value-objects/local-date.js';

/**
 * Composes an ordered array of {@link RulesetLayer}s into a single immutable
 * {@link EffectiveRuleset} snapshot.
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
 *                  keep this function pure and deterministic in tests.
 */
export function resolveEffectiveRuleset(
    layers: ReadonlyArray<RulesetLayer>,
    resolvedAt: LocalDate,
): EffectiveRuleset {
    return {
        // LocalDate is an immutable value object — its reference is safe to
        // share, so the snapshot preserves it directly (no defensive copy).
        resolvedAt,
        sourceLayerIds: layers.map((l) => l.id),
        classDefinitions: mergeById(layers.flatMap((l) => [...l.classDefinitions])),
        gradeScales: mergeById(layers.flatMap((l) => [...l.gradeScales])),
        awardTypes: mergeById(layers.flatMap((l) => [...l.awardTypes])),
        showTypes: mergeById(layers.flatMap((l) => [...l.showTypes])),
    };
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
