// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
    CollectiveAwardPolicy,
    CollectiveAwardResult,
} from '../domain/domain-services/collective-award-policy.js';
import type { CollectiveCompetitionResults } from '../domain/value-objects/collective-competition-results.js';

const BREEDERS_MIN = 3;
const BREEDERS_MAX = 5;
const PROGENY_MIN = 3;
const PROGENY_MAX = 5;

/**
 * In-memory FCI implementation of {@link CollectiveAwardPolicy}.
 *
 * **Brace/Couple** — validates that exactly one dog and one bitch of the
 * same breed/variety are present; returns both entries as the winning group.
 *
 * **Breeders' Group** — validates 3–5 dogs of the same breed/variety bred
 * under the same Kennel Name; returns all entries as the winning group.
 *
 * **Progeny Group** — validates a sire or dam with 3–5 first-generation
 * offspring present; returns all offspring entries as the winning group.
 *
 * This class lives in the `@ods/rulesets/testing` sub-path so the Judging
 * context can use it as a drop-in fake without pulling test tooling into
 * production bundles.
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
        const dogs = entries.filter((e) => e.sex === 'dog');
        const bitches = entries.filter((e) => e.sex === 'bitch');

        // Check bitch absence first so the reason names the missing sex when
        // all entries are of the same sex (e.g. "two dogs, no bitch").
        if (bitches.length === 0) {
            return {
                valid: false,
                reason: `Brace/Couple requires exactly one bitch; found ${bitches.length.toString()}`,
            };
        }
        if (dogs.length !== 1) {
            return {
                valid: false,
                reason: `Brace/Couple requires exactly one dog; found ${dogs.length.toString()}`,
            };
        }
        if (bitches.length !== 1) {
            return {
                valid: false,
                reason: `Brace/Couple requires exactly one bitch; found ${bitches.length.toString()}`,
            };
        }

        return {
            valid: true,
            winningGroupRefs: entries.map((e) => e.dogRef),
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
            winningGroupRefs: entries.map((e) => e.dogRef),
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
            winningGroupRefs: entries.map((e) => e.dogRef),
        };
    }
}
