// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
    Breed,
    Variety,
    Group,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/entities/breed.js';
import {
    asBreedId,
    asVarietyId,
    asGroupId,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/domain-ids.js';

// Per ADR-0010, `Breed`/`Variety`/`Group` carry no display `name` — display
// strings live in the i18n bundle keyed by `<concept-type>.<domain-id>`. These
// regression tests pin the public shape so a re-added `name` is caught at
// compile time.

describe('Breed', () => {
    it('carries identity, group, and recognition status — and no display name', () => {
        const breed = Breed.of({
            id: asBreedId('labrador'),
            groupId: asGroupId('gundogs'),
            recognitionStatus: 'definitive',
        });

        expect(breed).toBeInstanceOf(Breed);
        expect(breed.id).toBe(asBreedId('labrador'));
        expect(breed.groupId).toBe(asGroupId('gundogs'));
        expect(breed.recognitionStatus).toBe('definitive');
        expectTypeOf<Breed>().not.toHaveProperty('name');
    });
});

describe('Variety', () => {
    it('carries identity and breed — and no display name', () => {
        const variety = Variety.of({
            id: asVarietyId('long-hair'),
            breedId: asBreedId('labrador'),
        });

        expect(variety).toBeInstanceOf(Variety);
        expect(variety.id).toBe(asVarietyId('long-hair'));
        expect(variety.breedId).toBe(asBreedId('labrador'));
        expectTypeOf<Variety>().not.toHaveProperty('name');
    });
});

describe('Group', () => {
    it('carries identity and structural ordinal — and no display name', () => {
        const group = Group.of({ id: asGroupId('gundogs'), ordinal: 8 });

        expect(group).toBeInstanceOf(Group);
        expect(group.id).toBe(asGroupId('gundogs'));
        expect(group.ordinal).toBe(8);
        expectTypeOf<Group>().not.toHaveProperty('name');
    });
});
