// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expectTypeOf } from 'vitest';
import type { Breed, Variety, Group, RecognitionStatus } from '../domain/breed.js';
import type { BreedId, VarietyId, GroupId } from '../domain/domain-ids.js';

// Per ADR-0010, `Breed`/`Variety`/`Group` carry no display `name` — display
// strings live in the i18n bundle keyed by `<concept-type>.<domain-id>`. These
// regression tests pin the purely-structural shape so a re-added `name` is
// caught at compile time. `Group.ordinal` is retained (catalogue ordering).

describe('Breed', () => {
    it('carries identity, group, and recognition status — and no display name', () => {
        expectTypeOf<Breed>().toEqualTypeOf<{
            readonly id: BreedId;
            readonly groupId: GroupId;
            readonly recognitionStatus: RecognitionStatus;
        }>();
    });
});

describe('Variety', () => {
    it('carries identity and breed — and no display name', () => {
        expectTypeOf<Variety>().toEqualTypeOf<{
            readonly id: VarietyId;
            readonly breedId: BreedId;
        }>();
    });
});

describe('Group', () => {
    it('carries identity and structural ordinal — and no display name', () => {
        expectTypeOf<Group>().toEqualTypeOf<{
            readonly id: GroupId;
            /** Governs catalogue ordering; lower ordinal appears first. */
            readonly ordinal: number;
        }>();
    });
});
