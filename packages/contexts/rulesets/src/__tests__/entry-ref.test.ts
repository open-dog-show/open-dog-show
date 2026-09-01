// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import { asEntryRef } from '../domain/entry-ref.js';
import type { EntryRef } from '../domain/entry-ref.js';
import { asClassId } from '../domain/domain-ids.js';

describe('asEntryRef', () => {
    it('casts a raw string to an EntryRef, preserving the value', () => {
        expect(asEntryRef('entry-1')).toBe('entry-1');
    });

    it('returns an EntryRef-branded value', () => {
        expectTypeOf(asEntryRef('entry-1')).toEqualTypeOf<EntryRef>();
    });

    it('does not accept a bare string where EntryRef is expected', () => {
        // The brand is compile-time only: a plain string (e.g. a kennelName)
        // must not satisfy the EntryRef type, so a bare 'entry-1' is rejected
        // where EntryRef is required. The opaque entry-reference concept thus
        // stays distinct from other bare strings.
        // @ts-expect-error — a bare string is not an EntryRef
        const ref: EntryRef = 'entry-1';
        expect(ref).toBe('entry-1');
    });

    it('is not interchangeable with another branded string (e.g. ClassId)', () => {
        // A differently-branded string is not an EntryRef — the brand keeps the
        // opaque entry reference distinct from other rulesets domain ids.
        // @ts-expect-error — a ClassId is not an EntryRef
        const ref: EntryRef = asClassId('open');
        expect(ref).toBe('open');
    });
});
