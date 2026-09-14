// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RulesetLayerId } from '../../../domain/shared/domain-ids.js';
import type { LocalDate } from '../../../domain/model/effective-ruleset/value-objects/local-date.js';
import { RulesetLayerEdition } from '../../../domain/model/ruleset-layer-edition/ruleset-layer-edition.js';
import type { RulesetLayerEditionRepository } from '../../../domain/model/ruleset-layer-edition/ruleset-layer-edition-repository.js';
import { fci20260101, fci20270101 } from './fci/index.js';
import { kmsh20230101 } from './kmsh/index.js';

/** Every edition bundled with this deployment, across every ruleset layer. */
const BUNDLED_EDITIONS: readonly RulesetLayerEdition[] = [fci20260101, fci20270101, kmsh20230101];

/**
 * {@link RulesetLayerEditionRepository} backed by the ruleset content bundled
 * with this deployment (ADR-0001's 2026-09-11 amendment: "authored edition
 * content lives in an infrastructure adapter behind a domain
 * RulesetLayerEditionRepository port"). One TypeScript module per edition
 * under `fci/` and `kmsh/` — there is no I/O; `inForce` resolves in memory
 * and returns a Promise only to satisfy the port (a future database-backed
 * ruleset catalog would actually await).
 */
export class BundledRulesetLayerEditionRepository implements RulesetLayerEditionRepository {
    inForce(layerId: RulesetLayerId, date: LocalDate): Promise<RulesetLayerEdition | undefined> {
        return Promise.resolve(RulesetLayerEdition.latestInForce(BUNDLED_EDITIONS, layerId, date));
    }
}
