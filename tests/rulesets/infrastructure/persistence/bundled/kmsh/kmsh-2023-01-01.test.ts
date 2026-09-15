// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    kmsh20230101,
    KMSH_LAYER_ID,
    KMSH_AWARD_CAC,
    KMSH_AWARD_RCAC,
    KMSH_CLASS_FOKKERSKLAS,
} from '../../../../../../src/rulesets/infrastructure/persistence/bundled/kmsh/index.js';
import {
    fci20270101,
    FCI_AWARD_BOB,
    FCI_AWARD_BOS,
    FCI_CLASS_MINOR_PUPPY,
} from '../../../../../../src/rulesets/infrastructure/persistence/bundled/fci/index.js';
import { EffectiveRuleset } from '../../../../../../src/rulesets/domain/model/effective-ruleset/effective-ruleset.js';
import { asEffectiveRulesetId } from '../../../../../../src/rulesets/domain/shared/domain-ids.js';
import { LocalDate } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
import { findOrFail } from '../../../../../test-kit/index.js';
import type { HigherScopeAwardType } from '../../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';

describe('kmsh20230101 — structure', () => {
    it('has the expected KMSH layer id and effective date', () => {
        expect(kmsh20230101.layerId).toBe(KMSH_LAYER_ID);
        expect(kmsh20230101.effectiveFrom).toEqual(LocalDate.of(2023, 1, 1));
    });

    it('overrides Minor Puppy class with fromAgeMonths=3 (KMSH ART.23)', () => {
        const cls = findOrFail(
            kmsh20230101.classDefinitions.find((c) => c.id === FCI_CLASS_MINOR_PUPPY),
            'minor-puppy',
        );
        expect(cls.fromAgeMonths).toBe(3);
        expect(cls.lessThanAgeMonths).toBe(6);
    });

    it('adds the Fokkersklas class with bredByExhibitor=true, feeding CAC and RCAC', () => {
        const cls = findOrFail(
            kmsh20230101.classDefinitions.find((c) => c.id === KMSH_CLASS_FOKKERSKLAS),
            'Fokkersklas',
        );
        expect(cls.bredByExhibitor).toBe(true);
        expect(cls.fromAgeMonths).toBe(15);
        expect(cls.awardTypeIds).toContain(KMSH_AWARD_CAC);
        expect(cls.awardTypeIds).toContain(KMSH_AWARD_RCAC);
    });

    it('adds the national CAC and RCAC award types, per-sex and discretionary', () => {
        const cac = kmsh20230101.awardTypes.find((a) => a.id === KMSH_AWARD_CAC);
        const rcac = kmsh20230101.awardTypes.find((a) => a.id === KMSH_AWARD_RCAC);
        expect(cac?.scope).toBe('per-sex');
        expect(cac?.isDiscretionary).toBe(true);
        expect(rcac?.scope).toBe('per-sex');
        expect(rcac?.isDiscretionary).toBe(true);
    });

    it('adds no grade scale overrides — language is not a rule difference (ADR-0010)', () => {
        expect(kmsh20230101.gradeScales).toHaveLength(0);
    });
});

describe('EffectiveRuleset.resolve([fci20270101, kmsh20230101]) — wholesale BOB/BOS override (ADR-0017)', () => {
    const RULESET_ID = asEffectiveRulesetId('ruleset-1');
    const ruleset = EffectiveRuleset.resolve(
        RULESET_ID,
        [fci20270101, kmsh20230101],
        LocalDate.of(2027, 6, 1),
    );

    const individual = (id: typeof FCI_AWARD_BOB): HigherScopeAwardType => {
        const at = ruleset.awardTypes.find((a) => a.id === id);
        if (at === undefined || at.scope === 'per-sex' || at.scope === 'collective') {
            throw new Error(`higher-scope award type ${id} not found`);
        }
        return at;
    };

    it('has 11 class definitions (10 FCI + Fokkersklas; Minor Puppy is a KMSH override)', () => {
        expect(ruleset.classDefinitions).toHaveLength(11);
    });

    it('has 17 award types (15 FCI + CAC + RCAC)', () => {
        expect(ruleset.awardTypes).toHaveLength(17);
    });

    it('BOB/BOS fedBy adds the national CAC feeder (wholesale override, last layer wins)', () => {
        const expected = [
            { kind: 'award', awardTypeId: 'cacib' },
            { kind: 'award', awardTypeId: KMSH_AWARD_CAC },
            { kind: 'class', classId: 'junior' },
            { kind: 'class', classId: 'veteran' },
        ];
        expect(individual(FCI_AWARD_BOB).fedBy).toEqual(expected);
        expect(individual(FCI_AWARD_BOS).fedBy).toEqual(expected);
    });

    it('records both source editions', () => {
        expect(ruleset.sourceEditions).toEqual([
            { layerId: fci20270101.layerId, effectiveFrom: LocalDate.of(2027, 1, 1) },
            { layerId: kmsh20230101.layerId, effectiveFrom: LocalDate.of(2023, 1, 1) },
        ]);
    });
});
