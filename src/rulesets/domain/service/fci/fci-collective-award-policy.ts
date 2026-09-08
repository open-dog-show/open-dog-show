// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CollectiveAwardPolicy, CollectiveAwardResult } from '../collective-award-policy.js';
import type { CollectiveCompetitionResults } from '../../model/effective-ruleset/value-objects/collective-competition-results.js';

const BREEDERS_MIN = 3;
const BREEDERS_MAX = 5;
const PROGENY_MIN = 3;
const PROGENY_MAX = 5;

/**
 * In-memory FCI implementation of {@link CollectiveAwardPolicy}.
 *
 * **Brace/Couple** — validates the sex composition (exactly one dog and one
 * bitch) and returns both entries as the winning group. Breed/variety
 * consistency is not yet enforced.
 *
 * **Breeders' Group** — validates the group size (3–5 dogs) and returns all
 * entries as the winning group. Same-breed/variety and same-kennel-name
 * checks are not yet enforced.
 *
 * **Progeny Group** — validates the group size (3–5 entries) and returns all
 * entries as the winning group. The sire/dam-with-first-generation-offspring
 * structure is not yet enforced.
 *
 * This is a pure in-memory domain service (ADR-0001: concrete rulesets are
 * pure domain modules that depend only on the domain core) — not a test
 * double. It lives in the domain layer (`domain/service/fci/`) and is exported
 * from the `domain/service/fci/` relative-import barrel, kept separate from
 * `src/rulesets/index.ts` so the main export stays the abstraction surface
 * (the ports + data model); the composition root (`apps/api`) will wire it.
 * See ADR-0021.
 */
export class FciCollectiveAwardPolicy implements CollectiveAwardPolicy {
    evaluate(results: CollectiveCompetitionResults): CollectiveAwardResult {
        switch (results.kind) {
            case 'brace-couple':
                return this.evaluateBraceCouple(results.entries);
            case 'breeders-group':
                return this.evaluateBreedersGroup(results.entries);
            case 'progeny-group':
                return this.evaluateProgenyGroup(results.entries);
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private evaluateBraceCouple(
        entries: CollectiveCompetitionResults['entries'],
    ): CollectiveAwardResult {
        const males = entries.filter((e) => e.sex === 'male');
        const females = entries.filter((e) => e.sex === 'female');

        // Check female absence first so the reason names the missing sex when
        // all entries are of the same sex (e.g. "two males, no female").
        if (females.length === 0) {
            return {
                valid: false,
                reason: `Brace/Couple requires exactly one female; found ${females.length.toString()}`,
            };
        }
        if (males.length !== 1) {
            return {
                valid: false,
                reason: `Brace/Couple requires exactly one male; found ${males.length.toString()}`,
            };
        }
        if (females.length !== 1) {
            return {
                valid: false,
                reason: `Brace/Couple requires exactly one female; found ${females.length.toString()}`,
            };
        }

        return {
            valid: true,
            winningGroupRefs: entries.map((e) => e.entryRef),
        };
    }

    private evaluateBreedersGroup(
        entries: CollectiveCompetitionResults['entries'],
    ): CollectiveAwardResult {
        if (entries.length < BREEDERS_MIN) {
            return {
                valid: false,
                reason: `Breeders' Group requires at least ${BREEDERS_MIN.toString()} dogs; found ${entries.length.toString()}`,
            };
        }
        if (entries.length > BREEDERS_MAX) {
            return {
                valid: false,
                reason: `Breeders' Group allows at most ${BREEDERS_MAX.toString()} dogs; found ${entries.length.toString()}`,
            };
        }

        return {
            valid: true,
            winningGroupRefs: entries.map((e) => e.entryRef),
        };
    }

    private evaluateProgenyGroup(
        entries: CollectiveCompetitionResults['entries'],
    ): CollectiveAwardResult {
        if (entries.length < PROGENY_MIN) {
            return {
                valid: false,
                reason: `Progeny Group requires at least ${PROGENY_MIN.toString()} offspring; found ${entries.length.toString()}`,
            };
        }
        if (entries.length > PROGENY_MAX) {
            return {
                valid: false,
                reason: `Progeny Group allows at most ${PROGENY_MAX.toString()} offspring; found ${entries.length.toString()}`,
            };
        }

        return {
            valid: true,
            winningGroupRefs: entries.map((e) => e.entryRef),
        };
    }
}
