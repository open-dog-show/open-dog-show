// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
    AwardFeeder,
    ClassFeeder,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/entities/award-type.js';
import {
    asAwardTypeId,
    asClassId,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';

describe('AwardFeeder.equals', () => {
    it('is true for the same awardTypeId', () => {
        expect(
            AwardFeeder.of(asAwardTypeId('cacib')).equals(AwardFeeder.of(asAwardTypeId('cacib'))),
        ).toBe(true);
    });

    it('is false when awardTypeId differs', () => {
        expect(
            AwardFeeder.of(asAwardTypeId('cacib')).equals(AwardFeeder.of(asAwardTypeId('bob'))),
        ).toBe(false);
    });
});

describe('ClassFeeder.equals', () => {
    it('is true for the same classId', () => {
        expect(
            ClassFeeder.of(asClassId('junior')).equals(ClassFeeder.of(asClassId('junior'))),
        ).toBe(true);
    });

    it('is false when classId differs', () => {
        expect(
            ClassFeeder.of(asClassId('junior')).equals(ClassFeeder.of(asClassId('veteran'))),
        ).toBe(false);
    });
});
