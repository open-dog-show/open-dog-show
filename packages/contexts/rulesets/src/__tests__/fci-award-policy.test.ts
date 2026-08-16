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
import type { AwardType } from '../domain/award-type.js';
import type { ClassDefinition } from '../domain/class-definition.js';
import type { GradeScale } from '../domain/grade-scale.js';
import type { EffectiveRuleset } from '../domain/effective-ruleset.js';
import type { JudgingScopeResults } from '../domain/judging-scope-results.js';
import type { ProposedAwardAssignment } from '../domain/award-policy.js';

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
        fromAgeMonths: 15,
        lessThanAgeMonths: undefined,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_ID],
    },
    {
        id: JUNIOR_CLASS_ID,
        fromAgeMonths: 6,
        lessThanAgeMonths: 18,
        requiredCertificates: [],
        bredByExhibitor: false,
        gradeScaleId: GRADE_SCALE_ID,
        awardTypeIds: [CACIB_J_ID],
    },
    {
        id: VETERAN_CLASS_ID,
        fromAgeMonths: 96,
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
// per-sex scope — eligibleAwardTypes
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — per-sex scope — eligibleAwardTypes', () => {
    it('returns CACIB when there is an Excellent-1st dog in a CACIB-eligible class', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 1 },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(CACIB_ID);
    });

    it('does not include CACIB when the top dog received Very Good', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: VERY_GOOD, placement: 1 },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).not.toContain(CACIB_ID);
    });

    it('does not include CACIB when an Excellent dog placed 2nd', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 2 },
            ],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).not.toContain(CACIB_ID);
    });

    it('returns CACIB-J (not CACIB) for a Junior class with Excellent-1st', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: JUNIOR_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 1 },
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
                { classId: VETERAN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 1 },
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
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 1 },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: 'dog-1', awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(true);
    });

    it('returns failure when proposed CACIB targets a dog with Very Good grade', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: VERY_GOOD, placement: 1 },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: 'dog-1', awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });

    it('returns failure when proposed CACIB targets a dog placed 2nd', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 2 },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: 'dog-1', awardTypeId: CACIB_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });

    it('accepts a submission where a discretionary award is withheld (empty proposed list)', () => {
        const scope: JudgingScopeResults = {
            kind: 'per-sex',
            placements: [
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 1 },
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
                { classId: OPEN_CLASS_ID, dogRef: 'dog-1', gradeId: EXCELLENT, placement: 1 },
            ],
        };
        const proposed: ReadonlyArray<ProposedAwardAssignment> = [
            { dogRef: 'dog-1', awardTypeId: CACIB_J_ID },
        ];

        const result = policy.validateAwardChoices(scope, proposed, RULESET);

        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// breed scope — eligibleAwardTypes
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — breed scope — eligibleAwardTypes', () => {
    it('returns BOB and BOS when CACIB candidates are available from both sexes', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            maleCandidates: [{ dogRef: 'male-1', gradeId: EXCELLENT, awardTypeId: CACIB_ID }],
            femaleCandidates: [{ dogRef: 'female-1', gradeId: EXCELLENT, awardTypeId: CACIB_ID }],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(BOB_ID);
        expect(result).toContain(BOS_ID);
    });

    it('returns BOB and BOS when CACIB-J and CACIB-V candidates are present from both sexes', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            maleCandidates: [{ dogRef: 'male-1', gradeId: EXCELLENT, awardTypeId: CACIB_J_ID }],
            femaleCandidates: [{ dogRef: 'female-1', gradeId: EXCELLENT, awardTypeId: CACIB_V_ID }],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(BOB_ID);
        expect(result).toContain(BOS_ID);
    });

    it('returns no breed awards when male candidates are absent', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            maleCandidates: [],
            femaleCandidates: [{ dogRef: 'female-1', gradeId: EXCELLENT, awardTypeId: CACIB_ID }],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });

    it('returns no breed awards when female candidates are absent', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            maleCandidates: [{ dogRef: 'male-1', gradeId: EXCELLENT, awardTypeId: CACIB_ID }],
            femaleCandidates: [],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });

    it('returns no breed awards when all candidates have a grade below Excellent', () => {
        const scope: JudgingScopeResults = {
            kind: 'breed',
            maleCandidates: [{ dogRef: 'male-1', gradeId: VERY_GOOD, awardTypeId: CACIB_ID }],
            femaleCandidates: [{ dogRef: 'female-1', gradeId: VERY_GOOD, awardTypeId: CACIB_ID }],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// group scope — eligibleAwardTypes
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — group scope — eligibleAwardTypes', () => {
    it('returns Best-in-Group award type ID when BOB candidates are present', () => {
        const scope: JudgingScopeResults = {
            kind: 'group',
            bobCandidates: [{ dogRef: 'bob-1', gradeId: EXCELLENT, awardTypeId: BOB_ID }],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(BIG_ID);
    });

    it('returns no group awards when no BOB candidates are present', () => {
        const scope: JudgingScopeResults = {
            kind: 'group',
            bobCandidates: [],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// show scope — eligibleAwardTypes
// ---------------------------------------------------------------------------

describe('FciAwardPolicy — show scope — eligibleAwardTypes', () => {
    it('returns Best-in-Show award type ID when BIG candidates are present', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            bigCandidates: [{ dogRef: 'big-1', gradeId: EXCELLENT, awardTypeId: BIG_ID }],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toContain(BIS_ID);
    });

    it('returns no show awards when no BIG candidates are present', () => {
        const scope: JudgingScopeResults = {
            kind: 'show',
            bigCandidates: [],
        };

        const result = policy.eligibleAwardTypes(scope, RULESET);

        expect(result).toHaveLength(0);
    });
});
