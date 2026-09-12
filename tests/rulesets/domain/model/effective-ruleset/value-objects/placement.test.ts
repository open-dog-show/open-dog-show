// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    asPlacement,
    InvalidPlacementError,
} from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/placement.js';
import type { Placement } from '../../../../../../src/rulesets/domain/model/effective-ruleset/value-objects/placement.js';

describe('asPlacement', () => {
    it('casts a raw number to a Placement, preserving the value', () => {
        expect(asPlacement(1)).toBe(1);
    });

    it('accepts 1 (the lower bound)', () => {
        expect(asPlacement(1)).toBe(1);
    });

    it('returns a Placement-branded value', () => {
        expectTypeOf(asPlacement(1)).toEqualTypeOf<Placement>();
    });

    it('does not accept a bare number where Placement is expected', () => {
        // The brand is compile-time only: a plain number must not satisfy the
        // Placement type, so a bare `1` is rejected where Placement is required.
        // @ts-expect-error — a bare number is not a Placement
        const placement: Placement = 1;
        expect(placement).toBe(1);
    });

    it.each([
        ['zero', 0],
        ['negative', -1],
        ['non-integer', 1.5],
        ['NaN', Number.NaN],
    ])('rejects %s', (_label, placement) => {
        expect(() => asPlacement(placement)).toThrow(InvalidPlacementError);
    });

    it('InvalidPlacementError carries the offending value', () => {
        try {
            asPlacement(0);
            throw new Error('expected asPlacement to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidPlacementError);
            const invalid = error as InvalidPlacementError;
            expect(invalid.placement).toBe(0);
            expect(invalid.name).toBe('InvalidPlacementError');
        }
    });
});
