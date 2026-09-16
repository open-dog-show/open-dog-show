// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    ClassPlacement,
    PerSexJudgingScopeResults,
    HigherScopeJudgingScopeResults,
} from '../../../../../src/rulesets/domain/service/award-policy/judging-scope-results.js';
import { AwardFeederStream } from '../../../../../src/rulesets/domain/service/award-policy/candidate-stream.js';
import {
    asClassId,
    asGradeId,
    asAwardTypeId,
} from '../../../../../src/rulesets/domain/shared/domain-ids.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/service/collective-award-policy/entry-ref.js';
import { asPlacement } from '../../../../../src/rulesets/domain/service/award-policy/placement.js';

const CLASS_A = asClassId('open');
const CLASS_B = asClassId('junior');
const GRADE_A = asGradeId('excellent');
const AWARD_A = asAwardTypeId('cacib');
const AWARD_B = asAwardTypeId('bob');

describe('ClassPlacement.equals', () => {
    const base = {
        classId: CLASS_A,
        entryRef: asEntryRef('dog-1'),
        gradeId: GRADE_A,
        placement: asPlacement(1),
    };

    it('is true when every field matches', () => {
        expect(ClassPlacement.of(base).equals(ClassPlacement.of(base))).toBe(true);
    });

    it('is false when classId differs', () => {
        expect(
            ClassPlacement.of(base).equals(ClassPlacement.of({ ...base, classId: CLASS_B })),
        ).toBe(false);
    });

    it('is false when placement differs (including undefined vs defined)', () => {
        expect(
            ClassPlacement.of(base).equals(ClassPlacement.of({ ...base, placement: undefined })),
        ).toBe(false);
    });
});

describe('PerSexJudgingScopeResults.equals', () => {
    const placement = (classId = CLASS_A) =>
        ClassPlacement.of({
            classId,
            entryRef: asEntryRef('dog-1'),
            gradeId: GRADE_A,
            placement: asPlacement(1),
        });

    it('is true when placements match', () => {
        expect(
            PerSexJudgingScopeResults.of({ placements: [placement()] }).equals(
                PerSexJudgingScopeResults.of({ placements: [placement()] }),
            ),
        ).toBe(true);
    });

    it('is false when placements differ', () => {
        expect(
            PerSexJudgingScopeResults.of({ placements: [placement(CLASS_A)] }).equals(
                PerSexJudgingScopeResults.of({ placements: [placement(CLASS_B)] }),
            ),
        ).toBe(false);
    });
});

describe('HigherScopeJudgingScopeResults.equals', () => {
    const stream = () =>
        AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: undefined, candidates: [] });

    it('is true when kind and streams match', () => {
        expect(
            HigherScopeJudgingScopeResults.breed([stream()]).equals(
                HigherScopeJudgingScopeResults.breed([stream()]),
            ),
        ).toBe(true);
    });

    it('is false when kind differs', () => {
        expect(
            HigherScopeJudgingScopeResults.breed([stream()]).equals(
                HigherScopeJudgingScopeResults.group([stream()]),
            ),
        ).toBe(false);
    });

    it('is false when streams differ', () => {
        const other = AwardFeederStream.of({
            feederAwardTypeId: AWARD_B,
            sex: undefined,
            candidates: [],
        });
        expect(
            HigherScopeJudgingScopeResults.breed([stream()]).equals(
                HigherScopeJudgingScopeResults.breed([other]),
            ),
        ).toBe(false);
    });
});
