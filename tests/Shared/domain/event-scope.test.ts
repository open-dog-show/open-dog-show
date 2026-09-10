// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { asEventScope, EventScope } from '../../../src/Shared/index.js';

describe('EventScope factories', () => {
    it('club() / exhibitor() / platform() fix the kind tag', () => {
        expect(EventScope.club().kind).toBe('club');
        expect(EventScope.exhibitor().kind).toBe('exhibitor');
        expect(EventScope.platform().kind).toBe('platform');
    });
});

describe('EventScope.equals', () => {
    it('equals two scopes of the same kind', () => {
        expect(EventScope.club().equals(EventScope.club())).toBe(true);
        expect(EventScope.exhibitor().equals(EventScope.exhibitor())).toBe(true);
        expect(EventScope.platform().equals(EventScope.platform())).toBe(true);
    });

    it.each([
        ['club vs exhibitor', EventScope.club(), EventScope.exhibitor()],
        ['club vs platform', EventScope.club(), EventScope.platform()],
        ['exhibitor vs platform', EventScope.exhibitor(), EventScope.platform()],
    ])('does not equal across kinds (%s)', (_label, a, b) => {
        expect(a.equals(b)).toBe(false);
        expect(b.equals(a)).toBe(false);
    });

    it('treats a rehydrated scope as equal to a freshly built one of the same kind', () => {
        expect(asEventScope('club').equals(EventScope.club())).toBe(true);
        expect(asEventScope('exhibitor').equals(EventScope.exhibitor())).toBe(true);
        expect(asEventScope('platform').equals(EventScope.platform())).toBe(true);
    });
});
