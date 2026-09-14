// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { CollectiveEntry } from '../../../../../src/rulesets/domain/service/collective-award-policy/collective-entry.js';
import { asEntryRef } from '../../../../../src/rulesets/domain/service/collective-award-policy/entry-ref.js';

describe('CollectiveEntry.equals', () => {
    it('is true for the same entryRef and sex', () => {
        expect(
            CollectiveEntry.of(asEntryRef('dog-1'), 'male').equals(
                CollectiveEntry.of(asEntryRef('dog-1'), 'male'),
            ),
        ).toBe(true);
    });

    it('is false when entryRef differs', () => {
        expect(
            CollectiveEntry.of(asEntryRef('dog-1'), 'male').equals(
                CollectiveEntry.of(asEntryRef('dog-2'), 'male'),
            ),
        ).toBe(false);
    });

    it('is false when sex differs', () => {
        expect(
            CollectiveEntry.of(asEntryRef('dog-1'), 'male').equals(
                CollectiveEntry.of(asEntryRef('dog-1'), 'female'),
            ),
        ).toBe(false);
    });
});
