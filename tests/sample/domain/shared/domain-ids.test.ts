// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    asEntryId,
    asShowId,
    type EntryId,
    type ShowId,
} from '../../../../src/sample/domain/shared/domain-ids.js';

describe('asEntryId', () => {
    it('casts a raw string to an EntryId, preserving the value', () => {
        expect(asEntryId('entry-1')).toBe('entry-1');
    });

    it('returns an EntryId-branded value', () => {
        expectTypeOf(asEntryId('entry-1')).toEqualTypeOf<EntryId>();
    });
});

describe('asShowId', () => {
    it('casts a raw string to a ShowId, preserving the value', () => {
        expect(asShowId('show-1')).toBe('show-1');
    });

    it('returns a ShowId-branded value', () => {
        expectTypeOf(asShowId('show-1')).toEqualTypeOf<ShowId>();
    });
});

describe('EntryId brand isolation', () => {
    it('rejects a raw string where an EntryId is required', () => {
        // @ts-expect-error a raw string must not satisfy EntryId
        const id: EntryId = 'entry-1';
        expect(id).toStrictEqual(asEntryId('entry-1'));
    });

    it('rejects a ShowId where an EntryId is required (cross-id)', () => {
        const showId: ShowId = asShowId('show-1');
        // @ts-expect-error a ShowId must not satisfy EntryId
        const entryId: EntryId = showId;
        expect(entryId).toStrictEqual(asEntryId('show-1'));
    });
});

describe('ShowId brand isolation', () => {
    it('rejects a raw string where a ShowId is required', () => {
        // @ts-expect-error a raw string must not satisfy ShowId
        const id: ShowId = 'show-1';
        expect(id).toStrictEqual(asShowId('show-1'));
    });

    it('rejects an EntryId where a ShowId is required (cross-id)', () => {
        const entryId: EntryId = asEntryId('entry-1');
        // @ts-expect-error an EntryId must not satisfy ShowId
        const showId: ShowId = entryId;
        expect(showId).toStrictEqual(asShowId('entry-1'));
    });
});
