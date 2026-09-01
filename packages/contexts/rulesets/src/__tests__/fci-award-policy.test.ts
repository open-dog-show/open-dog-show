// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { FciAwardPolicy } from '../testing/fci-award-policy.js';
import {
    asAwardTypeId,
    asClassId,
    asGradeId,
    asGradeScaleId,
    asRulesetLayerId,
} from '../domain/domain-ids.js';
import { asAgeMonths } from '../domain/age-months.js';
import { asEntryRef } from '../domain/entry-ref.js';
import type { AwardTypeId, ClassId, GradeId } from '../domain/domain-ids.js';
import type { AwardType } from '../domain/award-type.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { GradeScale } from '../domain/grade-scale.js';
import type { EffectiveRuleset } from '../domain/effective-ruleset.js';
import type {
    CandidateStream,
    JudgingScopeResults,
    StreamCandidate,
} from '../domain/judging-scope-results.js';
import type { ProposedAwardAssignment } from '../domain/award-policy.js';
import { resolveEffectiveRuleset } from '../domain/resolve-effective-ruleset.js';
import type { LocalDate } from '../domain/local-date.js';
import {
    fciLayer,
    FCI_GRADE_EXCELLENT,
    FCI_GRADE_VERY_GOOD,
    FCI_GRADE_VERY_PROMISING,
    FCI_GRADE_PROMISING,
    FCI_AWARD_CACIB,
    FCI_AWARD_BOB,
    FCI_AWARD_BOS,
    FCI_AWARD_BIG,
    FCI_AWARD_BIS,
    FCI_AWARD_BEST_JUNIOR,
    FCI_AWARD_BEST_VETERAN,
    FCI_AWARD_BEST_PUPPY,
    FCI_AWARD_BEST_MINOR_PUPPY,
} from '../layers/fci-ruleset-layer.js';
import { kmshLayer, KMSH_AWARD_CAC } from '../layers/kmsh-ruleset-layer.js';

// ---------------------------------------------------------------------------
// Shared grade IDs
// ---------------------------------------------------------------------------

const EXCELLENT = asGradeId('excellent');
const VERY_GOOD = asGradeId('very-good');
const GRADE_SCALE_ID = asGradeScaleId('fci-standard');

// ---------------------------------------------------------------------------
// Shared award type IDs
// ---------------------------------------------------------------------------

const CACIB_ID = asAwardTypeId('cacib');
const CACIB_J_ID = asAwardTypeId('cacib-j');
const CACIB_V_ID = asAwardTypeId('cacib-v');
const BOB_ID = asAwardTypeId('bob');
const BOS_ID = asAwardTypeId('bos');
const BIG_ID = asAwardTypeId('big');
const BIS_ID = asAwardTypeId('bis');

// ---------------------------------------------------------------------------
// Shared class IDs
// ---------------------------------------------------------------------------

const OPEN_CLASS_ID = asClassId('open');
const JUNIOR_CLASS_ID = asClassId('junior');
const VETERAN_CLASS_ID = asClassId('veteran');

// ---------------------------------------------------------------------------
// FCI test ruleset fixture
// ---------------------------------------------------------------------------

const gradeScale: GradeScale = {
    id: GRADE_SCALE_ID,
    grades: [
        { id: EXCELLENT, ordinal: 0 },
        { id: VERY_GOOD, ordinal: 1 },
    ],
    placeableThresholdId: VERY_GOOD,
    specialOutcomes: [],
};

const awardTypes: ReadonlyArray<AwardType> = [
    {
        id: CACIB_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: 1,
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        id: CACIB_J_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: 1,
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        id: CACIB_V_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: 1,
        isDiscretionary: true,
        scope: 'per-sex',
    },
    {
        id: BOB_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'breed',
    },
    {
        id: BOS_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'breed',
    },
    {
        id: BIG_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'group',
    },
    {
        id: BIS_ID,
        minimumGradeId: EXCELLENT,
        minimumPlacement: undefined,
        isDiscretionary: false,
        scope: 'show',
    },
];

const classDefinitions: ReadonlyArray<ClassDefinition> = [
    {
        id: OPEN_CLASS_ID,
        fromAgeMonths: asAgeMonths(15),
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_ID],
    },
    {
        id: JUNIOR_CLASS_ID,
        fromAgeMonths: asAgeMonths(6),
        lessThanAgeMonths: asAgeMonths(18),
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_J_ID],
    },
    {
        id: VETERAN_CLASS_ID,
        fromAgeMonths: asAgeMonths(96),
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_V_ID],
    },
];

const RULESET: EffectiveRuleset = {
    resolvedAt: { year: 2026, month: 1, day: 1 },
    sourceLayerIds: [asRulesetLayerId('fci')],
    classDefinitions,
    gradeScales: [gradeScale],
    awardTypes,
    showTypes: [],
};

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

const policy = new FciAwardPolicy();
// ---------------------------------------------------------------------------
// Real-ruleset fixtures (ADR-0017 feeder model) + stream helpers
// ---------------------------------------------------------------------------

const RESOLVE_DATE: LocalDate = { year: 2026, month: 1, day: 1 };

/** FCI base layer only — BOB fedBy has no national CAC feeder. */
const FCI_RULESET: EffectiveRuleset = resolveEffectiveRuleset([fciLayer], RESOLVE_DATE);

/** FCI + KMSH — BOB/BOS overridden to add the national CAC feeder. */
const KMSH_RULESET: EffectiveRuleset = resolveEffectiveRuleset([fciLayer, kmshLayer], RESOLVE_DATE);

const cand = (dogRef: string, gradeId: GradeId): StreamCandidate => ({
    dogRef: asEntryRef(dogRef),
    gradeId,
});

/** An award-feeder stream (feeder is an Award Type); `sex` is breed-scope only. */
const awardStream = (
    feederAwardTypeId: AwardTypeId,
    sex: 'male' | 'female' | undefined,
    candidates: ReadonlyArray<StreamCandidate>,
): CandidateStream => ({ feederAwardTypeId, sex, candidates });

/** A class-feeder stream (feeder is a Class placement); `sex` is breed-scope only. */
const classStream = (
    feederClassId: ClassId,
    sex: 'male' | 'female' | undefined,
    candidates: ReadonlyArray<StreamCandidate>,
): CandidateStream => ({ feederClassId, sex, candidates });

// ---------------------------------------------------------------------------
// per-sex scope — eligibleAwardTypes
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — per-sex scope — eligibleAwardTypes', () => {
    it('returns CACIB when there is an Excellent-1st dog in a CACIB-eligible class', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 1,
                },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_ID);
    });

    it('does not include CACIB when the top dog received Very Good', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: VERY_GOOD,
                    placement: 1,
                },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).not.toContain(CACIB_ID);
    });

    it('does not include CACIB when an Excellent dog placed 2nd', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 2,
                },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).not.toContain(CACIB_ID);
    });

    it('returns CACIB-J (not CACIB) for a Junior class with Excellent-1st', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: JUNIOR_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 1,
                },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_J_ID);
        expect(result).not.toContain(CACIB_ID);
    });

    it('returns CACIB-V (not CACIB) for a Veteran class with Excellent-1st', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: VETERAN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 1,
                },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_V_ID);
        expect(result).not.toContain(CACIB_ID);
    });

    it('returns no award types when placements list is empty', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// per-sex scope — validateAwardChoices
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — per-sex scope — validateAwardChoices', () => {
    it('accepts a proposed CACIB for a dog with Excellent-1st', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 1,
                },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('dog-1'), awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(true);
    });

    it('returns failure when proposed CACIB targets a dog with Very Good grade', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: VERY_GOOD,
                    placement: 1,
                },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('dog-1'), awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });

    it('returns failure when proposed CACIB targets a dog placed 2nd', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 2,
                },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('dog-1'), awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });

    it('accepts a submission where a discretionary award is withheld (empty proposed list)', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 1,
                },
            ],
        };
        // Judge chooses not to award CACIB (isDiscretionary = true) — this is legal
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(true);
    });

    it('returns failure when proposed award type is not available for the dog\u2019s class', () => {
        // Dog is in Open class which only feeds CACIB, not CACIB-J
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                {
                    classId: OPEN_CLASS_ID,
                    dogRef: asEntryRef('dog-1'),
                    gradeId: EXCELLENT,
                    placement: 1,
                },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('dog-1'), awardTypeId: CACIB_J_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// breed scope — eligibleAwardTypes (feeder-keyed streams, ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — breed scope — eligibleAwardTypes', () => {
    it('returns BOB and BOS when a qualifying male and female CACIB stream are present', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('returns BOB and BOS when only junior class-win streams qualify from both sexes', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                classStream(asClassId('junior'), 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('junior'), 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('returns BOB and BOS when a male CACIB stream and a female veteran class-win stream qualify (multi-feeder)', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('veteran'), 'female', [
                    cand('female-1', FCI_GRADE_EXCELLENT),
                ]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('returns no breed awards when no male qualifying candidate is present', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('returns no breed awards when no female qualifying candidate is present', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)])],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('returns no breed awards when both sexes are present but graded below Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_VERY_GOOD)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_VERY_GOOD)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('ignores streams whose feeder matches no fedBy entry (out-of-scope feeder matches nothing)', () => {
        // A CAC stream is present, but the FCI-layer BOB fedBy has no CAC feeder,
        // so without a CACIB/junior/veteran stream BOB is not eligible.
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(KMSH_AWARD_CAC, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(KMSH_AWARD_CAC, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BOB);
    });
});

// ---------------------------------------------------------------------------
// group scope — eligibleAwardTypes (feeder-keyed streams, ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — group scope — eligibleAwardTypes', () => {
    it('returns BIG when a BOB feeder stream has a candidate graded Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'group',
            streams: [awardStream(FCI_AWARD_BOB, undefined, [cand('bob-1', FCI_GRADE_EXCELLENT)])],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BIG);
    });

    it('returns no group awards when the BOB feeder stream candidate is below Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'group',
            streams: [awardStream(FCI_AWARD_BOB, undefined, [cand('bob-1', FCI_GRADE_VERY_GOOD)])],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BIG);
    });

    it('returns no group awards when no feeder stream is present', () => {
        const scope: JudgingScopeResults = { kind: 'group', streams: [] };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// show scope — eligibleAwardTypes (feeder-keyed streams, ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — show scope — eligibleAwardTypes', () => {
    it('returns BIS only when a BIG feeder stream has a candidate graded Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)])],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BIS);
        expect(result).not.toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).not.toContain(FCI_AWARD_BEST_PUPPY);
    });

    it('returns Best Junior only when a junior class-win stream has a candidate graded Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('junior'), undefined, [cand('jr-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).not.toContain(FCI_AWARD_BIS);
    });

    it('returns Best Puppy only when a puppy class-win stream meets Very Promising', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('puppy'), undefined, [
                    cand('pup-1', FCI_GRADE_VERY_PROMISING),
                ]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_PUPPY);
    });

    it('does not return Best Puppy when the puppy stream candidate is below Very Promising', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('puppy'), undefined, [cand('pup-1', FCI_GRADE_PROMISING)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BEST_PUPPY);
    });

    it('returns Best Minor Puppy when a minor-puppy class-win stream meets Very Promising', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('minor-puppy'), undefined, [
                    cand('mp-1', FCI_GRADE_VERY_PROMISING),
                ]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_MINOR_PUPPY);
    });

    it('returns Best Veteran when a veteran class-win stream has a candidate graded Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('veteran'), undefined, [cand('vet-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_VETERAN);
    });

    it('returns no show awards when no feeder stream is present', () => {
        const scope: JudgingScopeResults = { kind: 'show', streams: [] };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('each show award is gated on its own feeder stream + minimumGradeId (mixed streams)', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('puppy'), undefined, [
                    cand('pup-1', FCI_GRADE_VERY_PROMISING),
                ]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BIS);
        expect(result).toContain(FCI_AWARD_BEST_PUPPY);
        expect(result).not.toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).not.toContain(FCI_AWARD_BEST_VETERAN);
        expect(result).not.toContain(FCI_AWARD_BEST_MINOR_PUPPY);
    });
});
// ---------------------------------------------------------------------------
// validateAwardChoices — breed scope (ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — breed scope — validateAwardChoices', () => {
    it('accepts BOB and BOS proposed from qualifying CACIB-stream dogs of both sexes', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { dogRef: asEntryRef('female-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('rejects a BOB proposal for a dog not present in any BOB feeder stream', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('intruder'), awardTypeId: FCI_AWARD_BOB },
            { dogRef: asEntryRef('female-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a BOB proposal for a dog graded below the award minimumGradeId', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_VERY_GOOD)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { dogRef: asEntryRef('female-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a missing non-discretionary BOS when both sexes qualify (BOB alone is not enough)', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects BOB and BOS proposed for dogs of the same sex', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-2', FCI_GRADE_EXCELLENT)]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { dogRef: asEntryRef('male-2'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects BOB and BOS proposed for the same dog', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { dogRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// validateAwardChoices — group & show scope (ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — group & show scope — validateAwardChoices', () => {
    it('accepts a valid BIS proposal from a BIG-stream candidate graded Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)])],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('big-1'), awardTypeId: FCI_AWARD_BIS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('rejects a BIS proposal for a dog graded below Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_VERY_GOOD)])],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('big-1'), awardTypeId: FCI_AWARD_BIS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a BIS proposal for a dog not in a BIG feeder stream', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)])],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('intruder'), awardTypeId: FCI_AWARD_BIS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a missing non-discretionary BIS when a qualifying BIG stream is present', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)])],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('accepts a valid Best Puppy proposal from a puppy-class-stream candidate graded Very Promising', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('puppy'), undefined, [
                    cand('pup-1', FCI_GRADE_VERY_PROMISING),
                ]),
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('pup-1'), awardTypeId: FCI_AWARD_BEST_PUPPY },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('accepts an empty proposal when no feeder stream qualifies (no mandatory award triggered)', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_VERY_GOOD)])],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('accepts a valid BIG proposal from a BOB-stream candidate graded Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'group',
            streams: [awardStream(FCI_AWARD_BOB, undefined, [cand('bob-1', FCI_GRADE_EXCELLENT)])],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: asEntryRef('bob-1'), awardTypeId: FCI_AWARD_BIG },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// CAC-show case — KMSH layer (ADR-0017 show-type-aware feeding)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — CAC-show case (KMSH layer)', () => {
    it('BOB is eligible from CAC + class-win feeders when no CACIB stream is present (breed scope)', () => {
        // CAC-only show: a CAC stream + junior/veteran class-win streams from
        // both sexes, but NO CACIB/CACIB-J/CACIB-V streams. The KMSH-layer BOB
        // fedBy includes CAC; the absent CACIB feeder matches nothing.
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(KMSH_AWARD_CAC, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(KMSH_AWARD_CAC, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('junior'), 'male', [cand('male-jr', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('junior'), 'female', [
                    cand('female-jr', FCI_GRADE_EXCELLENT),
                ]),
                classStream(asClassId('veteran'), 'male', [cand('male-vet', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('veteran'), 'female', [
                    cand('female-vet', FCI_GRADE_EXCELLENT),
                ]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, KMSH_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('Best Junior and Best Veteran in Show are eligible from class-win streams (show scope)', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            streams: [
                classStream(asClassId('junior'), undefined, [cand('jr-1', FCI_GRADE_EXCELLENT)]),
                classStream(asClassId('veteran'), undefined, [cand('vet-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, KMSH_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).toContain(FCI_AWARD_BEST_VETERAN);
        expect(result).not.toContain(FCI_AWARD_BIS);
    });

    it('FCI-layer BOB is NOT eligible from a CAC stream alone (CAC feeder unknown to FCI layer)', () => {
        // Same streams, but resolved against the FCI-only ruleset: BOB fedBy has
        // no CAC feeder, and no CACIB/junior/veteran stream is present.
        const scope: JudgingScopeResults = {
            kind: 'breed',
            streams: [
                awardStream(KMSH_AWARD_CAC, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
                awardStream(KMSH_AWARD_CAC, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            ],
        };

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BOB);
    });
});
