// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayer } from '../model/effective-ruleset/entities/ruleset-layer.js';
import { EffectiveRuleset } from '../model/effective-ruleset/effective-ruleset.js';
import type { LocalDate } from '../model/effective-ruleset/value-objects/local-date.js';

/**
 * Composes an ordered array of {@link RulesetLayer}s into a single immutable
 * {@link EffectiveRuleset} snapshot.
 *
 * A thin wrapper over the aggregate's own {@link EffectiveRuleset.resolve}
 * factory (ADR-0022) — kept as a domain-service export so callers importing
 * `resolveEffectiveRuleset` from the `rulesets` barrel are unaffected by the
 * aggregate-to-class conversion. See {@link EffectiveRuleset.resolve} for the
 * merge rules.
 */
export function resolveEffectiveRuleset(
    layers: ReadonlyArray<RulesetLayer>,
    resolvedAt: LocalDate,
): EffectiveRuleset {
    return EffectiveRuleset.resolve(layers, resolvedAt);
}
