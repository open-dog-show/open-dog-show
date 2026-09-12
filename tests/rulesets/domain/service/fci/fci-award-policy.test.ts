// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { FciAwardPolicy } from '../../../../../src/rulesets/domain/service/fci/fci-award-policy.js';
import {
    asAwardTypeId,
    asClassId,
    asGradeScaleId,
    asRulesetLayerId,
    asEffectiveRulesetId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import { asAgeMonths } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/age-months.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/entry-ref.js';
import { asPlacement } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/placement.js';
import type {
    AwardTypeId,
    ClassId,
    GradeId,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';
import type { AwardType } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import {
    PerSexAwardType,
    HigherScopeAwardType,
    AwardFeeder,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import { ClassDefinition } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/class-definition.js';
import {
    GradeScale,
    Grade,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/grade-scale.js';
import { RulesetLayer } from '../../../../../src/rulesets/domain/model/effective-ruleset/entities/ruleset-layer.js';
import { EffectiveRuleset } from '../../../../../src/rulesets/domain/model/effective-ruleset/effective-ruleset.js';
import {
    StreamCandidate,
    AwardFeederStream,
    ClassFeederStream,
    PerSexJudgingScopeResults,
    HigherScopeJudgingScopeResults,
    ClassPlacement,
    type CandidateStream,
    type JudgingScopeResults,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/judging-scope-results.js';
import type { ProposedAwardAssignment } from '../../../../../src/rulesets/domain/service/award-policy.js';
import { resolveEffectiveRuleset } from '../../../../../src/rulesets/domain/service/resolve-effective-ruleset.js';
import { LocalDate } from '../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/local-date.js';
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
} from '../../../../../src/rulesets/domain/model/effective-ruleset/layers/fci-ruleset-layer.js';
import {
    kmshLayer,
    KMSH_AWARD_CAC,
} from '../../../../../src/rulesets/domain/model/effective-ruleset/layers/kmsh-ruleset-layer.js';

// ---------------------------------------------------------------------------
// Shared grade IDs
// ---------------------------------------------------------------------------

const GRADE_SCALE_ID = asGradeScaleId('test-standard');
const RULESET_ID = asEffectiveRulesetId('ruleset-1');

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

const gradeScale: GradeScale = GradeScale.of({
    id: GRADE_SCALE_ID,
    grades: [Grade.of(FCI_GRADE_EXCELLENT, 0), Grade.of(FCI_GRADE_VERY_GOOD, 1)],
    placeableThresholdId: FCI_GRADE_VERY_GOOD,
    specialOutcomes: [],
});

const awardTypes: ReadonlyArray<AwardType> = [
    PerSexAwardType.of({
        id: CACIB_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: asPlacement(1),
        isDiscretionary: true,
    }),
    PerSexAwardType.of({
        id: CACIB_J_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: asPlacement(1),
        isDiscretionary: true,
    }),
    PerSexAwardType.of({
        id: CACIB_V_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: asPlacement(1),
        isDiscretionary: true,
    }),
    HigherScopeAwardType.breed({
        id: BOB_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        fedBy: [AwardFeeder.of(CACIB_ID)],
    }),
    HigherScopeAwardType.breed({
        id: BOS_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        fedBy: [AwardFeeder.of(CACIB_ID)],
    }),
    HigherScopeAwardType.group({
        id: BIG_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        fedBy: [AwardFeeder.of(BOB_ID)],
    }),
    HigherScopeAwardType.show({
        id: BIS_ID,
        minimumGradeId: FCI_GRADE_EXCELLENT,
        worstEligiblePlacement: undefined,
        isDiscretionary: false,
        fedBy: [AwardFeeder.of(BIG_ID)],
    }),
];

const classDefinitions: ReadonlyArray<ClassDefinition> = [
    ClassDefinition.of({
        id: OPEN_CLASS_ID,
        fromAgeMonths: asAgeMonths(15),
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_ID],
    }),
    ClassDefinition.of({
        id: JUNIOR_CLASS_ID,
        fromAgeMonths: asAgeMonths(6),
        lessThanAgeMonths: asAgeMonths(18),
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_J_ID],
    }),
    ClassDefinition.of({
        id: VETERAN_CLASS_ID,
        fromAgeMonths: asAgeMonths(96),
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_V_ID],
    }),
];

const RULESET: EffectiveRuleset = EffectiveRuleset.resolve(
    RULESET_ID,
    [
        RulesetLayer.of({
            id: asRulesetLayerId('fci'),
            parentLayerId: undefined,
            classDefinitions,
            gradeScales: [gradeScale],
            awardTypes,
            showTypes: [],
        }),
    ],
    LocalDate.of(2026, 1, 1),
);

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

const policy = new FciAwardPolicy();
// ---------------------------------------------------------------------------
// Real-ruleset fixtures (ADR-0017 feeder model) + stream helpers
// ---------------------------------------------------------------------------

const RESOLVE_DATE: LocalDate = LocalDate.of(2026, 1, 1);

/** FCI base layer only — BOB fedBy has no national CAC feeder. */
const FCI_RULESET: EffectiveRuleset = resolveEffectiveRuleset(RULESET_ID, [fciLayer], RESOLVE_DATE);

/** FCI + KMSH — BOB/BOS overridden to add the national CAC feeder. */
const KMSH_RULESET: EffectiveRuleset = resolveEffectiveRuleset(
    RULESET_ID,
    [fciLayer, kmshLayer],
    RESOLVE_DATE,
);

const cand = (entryRef: string, gradeId: GradeId): StreamCandidate =>
    StreamCandidate.of(asEntryRef(entryRef), gradeId);

/** An award-feeder stream (feeder is an Award Type); `sex` is breed-scope only. */
const awardStream = (
    feederAwardTypeId: AwardTypeId,
    sex: 'male' | 'female' | undefined,
    candidates: ReadonlyArray<StreamCandidate>,
): CandidateStream => AwardFeederStream.of({ feederAwardTypeId, sex, candidates });

/** A class-feeder stream (feeder is a Class placement); `sex` is breed-scope only. */
const classStream = (
    feederClassId: ClassId,
    sex: 'male' | 'female' | undefined,
    candidates: ReadonlyArray<StreamCandidate>,
): CandidateStream => ClassFeederStream.of({ feederClassId, sex, candidates });

/** A per-sex scope with a single dog-1 placement — the common shape of the per-sex tests. */
const perSexScope = (
    classId: ClassId,
    gradeId: GradeId,
    placement: number | undefined,
): JudgingScopeResults =>
    PerSexJudgingScopeResults.of({
        placements: [
            ClassPlacement.of({
                classId,
                entryRef: asEntryRef('dog-1'),
                gradeId,
                placement: placement === undefined ? undefined : asPlacement(placement),
            }),
        ],
    });

/** A per-sex scope built from explicit placements — for multi-dog per-sex tests. */
const perSexScopeOf = (placements: ReadonlyArray<ClassPlacement>): JudgingScopeResults =>
    PerSexJudgingScopeResults.of({ placements });

const breedScope = (streams: ReadonlyArray<CandidateStream>): JudgingScopeResults =>
    HigherScopeJudgingScopeResults.breed(streams);

const groupScope = (streams: ReadonlyArray<CandidateStream>): JudgingScopeResults =>
    HigherScopeJudgingScopeResults.group(streams);

const showScope = (streams: ReadonlyArray<CandidateStream>): JudgingScopeResults =>
    HigherScopeJudgingScopeResults.show(streams);

// ---------------------------------------------------------------------------
// per-sex scope — eligibleAwardTypes
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — per-sex scope — eligibleAwardTypes', () => {
    it('returns CACIB when there is an FCI_GRADE_EXCELLENT-1st dog in a CACIB-eligible class', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_EXCELLENT, 1);

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_ID);
    });

    it('does not include CACIB when the top dog received Very Good', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_VERY_GOOD, 1);

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).not.toContain(CACIB_ID);
    });

    it('does not include CACIB when an FCI_GRADE_EXCELLENT dog placed 2nd', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_EXCELLENT, 2);

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).not.toContain(CACIB_ID);
    });

    it('returns CACIB-J (not CACIB) for a Junior class with FCI_GRADE_EXCELLENT-1st', () => {
        const scope = perSexScope(JUNIOR_CLASS_ID, FCI_GRADE_EXCELLENT, 1);

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_J_ID);
        expect(result).not.toContain(CACIB_ID);
    });

    it('returns CACIB-V (not CACIB) for a Veteran class with FCI_GRADE_EXCELLENT-1st', () => {
        const scope = perSexScope(VETERAN_CLASS_ID, FCI_GRADE_EXCELLENT, 1);

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_V_ID);
        expect(result).not.toContain(CACIB_ID);
    });

    it('returns no award types when placements list is empty', () => {
        const scope: JudgingScopeResults = perSexScopeOf([]);

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// per-sex scope — validateAwardChoices
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — per-sex scope — validateAwardChoices', () => {
    it('accepts a proposed CACIB for a dog with FCI_GRADE_EXCELLENT-1st', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_EXCELLENT, 1);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('dog-1'), awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(true);
    });

    it('returns failure when proposed CACIB targets a dog with Very Good grade', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_VERY_GOOD, 1);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('dog-1'), awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });

    it('returns failure when proposed CACIB targets a dog placed 2nd', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_EXCELLENT, 2);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('dog-1'), awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });

    it('accepts a submission where a discretionary award is withheld (empty proposed list)', () => {
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_EXCELLENT, 1);
        // Judge chooses not to award CACIB (isDiscretionary = true) — this is legal
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(true);
    });

    it('returns failure when proposed award type is not available for the dog’s class', () => {
        // Dog is in Open class which only feeds CACIB, not CACIB-J
        const scope = perSexScope(OPEN_CLASS_ID, FCI_GRADE_EXCELLENT, 1);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('dog-1'), awardTypeId: CACIB_J_ID },
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
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('returns BOB and BOS when only junior class-win streams qualify from both sexes', () => {
        const scope = breedScope([
            classStream(asClassId('junior'), 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('junior'), 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('returns BOB and BOS when a male CACIB stream and a female veteran class-win stream qualify (multi-feeder)', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('veteran'), 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('returns no breed awards when no male qualifying candidate is present', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('returns no breed awards when no female qualifying candidate is present', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('returns no breed awards when both sexes are present but graded below FCI_GRADE_EXCELLENT', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_VERY_GOOD)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_VERY_GOOD)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('ignores streams whose feeder matches no fedBy entry (out-of-scope feeder matches nothing)', () => {
        // A CAC stream is present, but the FCI-layer BOB fedBy has no CAC feeder,
        // so without a CACIB/junior/veteran stream BOB is not eligible.
        const scope = breedScope([
            awardStream(KMSH_AWARD_CAC, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(KMSH_AWARD_CAC, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BOB);
    });
});

// ---------------------------------------------------------------------------
// group scope — eligibleAwardTypes (feeder-keyed streams, ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — group scope — eligibleAwardTypes', () => {
    it('returns BIG when a BOB feeder stream has a candidate graded FCI_GRADE_EXCELLENT', () => {
        const scope = groupScope([
            awardStream(FCI_AWARD_BOB, undefined, [cand('bob-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BIG);
    });

    it('returns no group awards when the BOB feeder stream candidate is below FCI_GRADE_EXCELLENT', () => {
        const scope = groupScope([
            awardStream(FCI_AWARD_BOB, undefined, [cand('bob-1', FCI_GRADE_VERY_GOOD)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BIG);
    });

    it('returns no group awards when no feeder stream is present', () => {
        const scope = groupScope([]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// show scope — eligibleAwardTypes (feeder-keyed streams, ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — show scope — eligibleAwardTypes', () => {
    it('returns BIS only when a BIG feeder stream has a candidate graded FCI_GRADE_EXCELLENT', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BIS);
        expect(result).not.toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).not.toContain(FCI_AWARD_BEST_PUPPY);
    });

    it('returns Best Junior only when a junior class-win stream has a candidate graded FCI_GRADE_EXCELLENT', () => {
        const scope = showScope([
            classStream(asClassId('junior'), undefined, [cand('jr-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).not.toContain(FCI_AWARD_BIS);
    });

    it('returns Best Puppy only when a puppy class-win stream meets Very Promising', () => {
        const scope = showScope([
            classStream(asClassId('puppy'), undefined, [cand('pup-1', FCI_GRADE_VERY_PROMISING)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_PUPPY);
    });

    it('does not return Best Puppy when the puppy stream candidate is below Very Promising', () => {
        const scope = showScope([
            classStream(asClassId('puppy'), undefined, [cand('pup-1', FCI_GRADE_PROMISING)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BEST_PUPPY);
    });

    it('returns Best Minor Puppy when a minor-puppy class-win stream meets Very Promising', () => {
        const scope = showScope([
            classStream(asClassId('minor-puppy'), undefined, [
                cand('mp-1', FCI_GRADE_VERY_PROMISING),
            ]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_MINOR_PUPPY);
    });

    it('returns Best Veteran when a veteran class-win stream has a candidate graded FCI_GRADE_EXCELLENT', () => {
        const scope = showScope([
            classStream(asClassId('veteran'), undefined, [cand('vet-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_VETERAN);
    });

    it('returns no show awards when no feeder stream is present', () => {
        const scope = showScope([]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).toHaveLength(0);
    });

    it('each show award is gated on its own feeder stream + minimumGradeId (mixed streams)', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('puppy'), undefined, [cand('pup-1', FCI_GRADE_VERY_PROMISING)]),
        ]);

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
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { entryRef: asEntryRef('female-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('rejects a BOB proposal for a dog not present in any BOB feeder stream', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('intruder'), awardTypeId: FCI_AWARD_BOB },
            { entryRef: asEntryRef('female-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a BOB proposal for a dog graded below the award minimumGradeId', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_VERY_GOOD)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { entryRef: asEntryRef('female-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a missing non-discretionary BOS when both sexes qualify (BOB alone is not enough)', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects BOB and BOS proposed for dogs of the same sex', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-2', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { entryRef: asEntryRef('male-2'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects BOB and BOS proposed for the same dog', () => {
        const scope = breedScope([
            awardStream(FCI_AWARD_CACIB, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(FCI_AWARD_CACIB, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOB },
            { entryRef: asEntryRef('male-1'), awardTypeId: FCI_AWARD_BOS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// validateAwardChoices — group & show scope (ADR-0017)
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — group & show scope — validateAwardChoices', () => {
    it('accepts a valid BIS proposal from a BIG-stream candidate graded FCI_GRADE_EXCELLENT', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('big-1'), awardTypeId: FCI_AWARD_BIS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('rejects a BIS proposal for a dog graded below FCI_GRADE_EXCELLENT', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_VERY_GOOD)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('big-1'), awardTypeId: FCI_AWARD_BIS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a BIS proposal for a dog not in a BIG feeder stream', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('intruder'), awardTypeId: FCI_AWARD_BIS },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('rejects a missing non-discretionary BIS when a qualifying BIG stream is present', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(false);
    });

    it('accepts a valid Best Puppy proposal from a puppy-class-stream candidate graded Very Promising', () => {
        const scope = showScope([
            classStream(asClassId('puppy'), undefined, [cand('pup-1', FCI_GRADE_VERY_PROMISING)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('pup-1'), awardTypeId: FCI_AWARD_BEST_PUPPY },
        ];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('accepts an empty proposal when no feeder stream qualifies (no mandatory award triggered)', () => {
        const scope = showScope([
            awardStream(FCI_AWARD_BIG, undefined, [cand('big-1', FCI_GRADE_VERY_GOOD)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [];

        const result = policy.validateAwardChoices(scope, proposed, FCI_RULESET);

        expect(result.valid).toBe(true);
    });

    it('accepts a valid BIG proposal from a BOB-stream candidate graded FCI_GRADE_EXCELLENT', () => {
        const scope = groupScope([
            awardStream(FCI_AWARD_BOB, undefined, [cand('bob-1', FCI_GRADE_EXCELLENT)]),
        ]);
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { entryRef: asEntryRef('bob-1'), awardTypeId: FCI_AWARD_BIG },
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
        const scope = breedScope([
            awardStream(KMSH_AWARD_CAC, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(KMSH_AWARD_CAC, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('junior'), 'male', [cand('male-jr', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('junior'), 'female', [cand('female-jr', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('veteran'), 'male', [cand('male-vet', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('veteran'), 'female', [cand('female-vet', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, KMSH_RULESET);

        expect(result).toContain(FCI_AWARD_BOB);
        expect(result).toContain(FCI_AWARD_BOS);
    });

    it('Best Junior and Best Veteran in Show are eligible from class-win streams (show scope)', () => {
        const scope = showScope([
            classStream(asClassId('junior'), undefined, [cand('jr-1', FCI_GRADE_EXCELLENT)]),
            classStream(asClassId('veteran'), undefined, [cand('vet-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, KMSH_RULESET);

        expect(result).toContain(FCI_AWARD_BEST_JUNIOR);
        expect(result).toContain(FCI_AWARD_BEST_VETERAN);
        expect(result).not.toContain(FCI_AWARD_BIS);
    });

    it('FCI-layer BOB is NOT eligible from a CAC stream alone (CAC feeder unknown to FCI layer)', () => {
        // Same streams, but resolved against the FCI-only ruleset: BOB fedBy has
        // no CAC feeder, and no CACIB/junior/veteran stream is present.
        const scope = breedScope([
            awardStream(KMSH_AWARD_CAC, 'male', [cand('male-1', FCI_GRADE_EXCELLENT)]),
            awardStream(KMSH_AWARD_CAC, 'female', [cand('female-1', FCI_GRADE_EXCELLENT)]),
        ]);

        const result = policy.eligibleAwardTypes(scope, FCI_RULESET);

        expect(result).not.toContain(FCI_AWARD_BOB);
    });
});
