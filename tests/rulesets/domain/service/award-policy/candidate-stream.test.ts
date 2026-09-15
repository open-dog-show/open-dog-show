// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    StreamCandidate,
    AwardFeederStream,
    ClassFeederStream,
} from '../../../../../src/rulesets/domain/service/award-policy/candidate-stream.js';
import {
    asClassId,
    asGradeId,
    asAwardTypeId,
} from '../../../../../src/rulesets/domain/shared/domain-ids.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/service/collective-award-policy/entry-ref.js';

const CLASS_A = asClassId('open');
const CLASS_B = asClassId('junior');
const GRADE_A = asGradeId('excellent');
const GRADE_B = asGradeId('very-good');
const AWARD_A = asAwardTypeId('cacib');
const AWARD_B = asAwardTypeId('bob');

describe('StreamCandidate.equals', () => {
    it('is true for the same entryRef and gradeId', () => {
        expect(
            StreamCandidate.of(asEntryRef('dog-1'), GRADE_A).equals(
                StreamCandidate.of(asEntryRef('dog-1'), GRADE_A),
            ),
        ).toBe(true);
    });

    it('is false when gradeId differs', () => {
        expect(
            StreamCandidate.of(asEntryRef('dog-1'), GRADE_A).equals(
                StreamCandidate.of(asEntryRef('dog-1'), GRADE_B),
            ),
        ).toBe(false);
    });
});

describe('AwardFeederStream.equals', () => {
    it('is true when feeder, sex, and candidates all match', () => {
        const candidates = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_A)];
        expect(
            AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: 'male', candidates }).equals(
                AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: 'male', candidates }),
            ),
        ).toBe(true);
    });

    it('is false when feederAwardTypeId differs', () => {
        const candidates = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_A)];
        expect(
            AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: 'male', candidates }).equals(
                AwardFeederStream.of({ feederAwardTypeId: AWARD_B, sex: 'male', candidates }),
            ),
        ).toBe(false);
    });

    it('is false when candidate lists differ in length', () => {
        const one = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_A)];
        const two = [
            StreamCandidate.of(asEntryRef('dog-1'), GRADE_A),
            StreamCandidate.of(asEntryRef('dog-2'), GRADE_A),
        ];
        expect(
            AwardFeederStream.of({
                feederAwardTypeId: AWARD_A,
                sex: 'male',
                candidates: one,
            }).equals(
                AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: 'male', candidates: two }),
            ),
        ).toBe(false);
    });

    it('is false when a candidate in the list differs', () => {
        const a = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_A)];
        const b = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_B)];
        expect(
            AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: 'male', candidates: a }).equals(
                AwardFeederStream.of({ feederAwardTypeId: AWARD_A, sex: 'male', candidates: b }),
            ),
        ).toBe(false);
    });
});

describe('ClassFeederStream.equals', () => {
    it('is true when feeder, sex, and candidates all match', () => {
        const candidates = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_A)];
        expect(
            ClassFeederStream.of({ feederClassId: CLASS_A, sex: undefined, candidates }).equals(
                ClassFeederStream.of({ feederClassId: CLASS_A, sex: undefined, candidates }),
            ),
        ).toBe(true);
    });

    it('is false when feederClassId differs', () => {
        const candidates = [StreamCandidate.of(asEntryRef('dog-1'), GRADE_A)];
        expect(
            ClassFeederStream.of({ feederClassId: CLASS_A, sex: undefined, candidates }).equals(
                ClassFeederStream.of({ feederClassId: CLASS_B, sex: undefined, candidates }),
            ),
        ).toBe(false);
    });
});
