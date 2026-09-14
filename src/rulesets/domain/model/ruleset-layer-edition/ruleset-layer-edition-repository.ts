// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayerId } from '../../shared/domain-ids.js';
import type { LocalDate } from '../effective-ruleset/value-objects/local-date.js';
import type { RulesetLayerEdition } from './ruleset-layer-edition.js';

/**
 * Persistence port for {@link RulesetLayerEdition}s (ADR-0029; ADR-0001's
 * 2026-09-11 amendment). Authored FCI/KMSH content lives behind this port in
 * an infrastructure adapter (`infrastructure/persistence/bundled/<ruleset>/`,
 * one module per edition) — the domain core depends only on this interface,
 * never on the concrete content.
 */
export interface RulesetLayerEditionRepository {
    /**
     * The latest {@link RulesetLayerEdition} of `layerId` effective on or
     * before `date`, or `undefined` when no edition of that layer is in
     * force yet on `date`.
     */
    inForce(layerId: RulesetLayerId, date: LocalDate): Promise<RulesetLayerEdition | undefined>;
}
