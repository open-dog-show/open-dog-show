// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayer } from '../model/effective-ruleset/entities/ruleset-layer.js';
import { EffectiveRuleset } from '../model/effective-ruleset/effective-ruleset.js';
import type { EffectiveRulesetId } from '../model/effective-ruleset/value-objects/domain-ids.js';
import type { LocalDate } from '../model/effective-ruleset/value-objects/local-date.js';

/**
 * Composes an ordered array of {@link RulesetLayer}s into a single immutable,
 * identified, validated {@link EffectiveRuleset} snapshot.
 *
 * A thin wrapper over the aggregate's own {@link EffectiveRuleset.resolve}
 * factory (ADR-0022) — kept as a domain-service export so callers importing
 * `resolveEffectiveRuleset` from the `rulesets` barrel are unaffected by the
 * aggregate-to-class conversion. See {@link EffectiveRuleset.resolve} for the
 * merge rules and the reference validation it performs.
 */
export function resolveEffectiveRuleset(
    id: EffectiveRulesetId,
    layers: ReadonlyArray<RulesetLayer>,
    resolvedFor: LocalDate,
): EffectiveRuleset {
    return EffectiveRuleset.resolve(id, layers, resolvedFor);
}
