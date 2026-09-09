// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    asEventScope,
    ClubEventScope,
    ExhibitorEventScope,
    PlatformEventScope,
    eventScopesEqual,
} from '../../../src/Shared/index.js';

describe('EventScope variant equality', () => {
    it('each data-less variant equals another instance of the same variant', () => {
        expect(ClubEventScope.of().equals(ClubEventScope.of())).toBe(true);
        expect(ExhibitorEventScope.of().equals(ExhibitorEventScope.of())).toBe(true);
        expect(PlatformEventScope.of().equals(PlatformEventScope.of())).toBe(true);
    });
});

describe('eventScopesEqual', () => {
    it('equals two scopes of the same kind', () => {
        expect(eventScopesEqual(ClubEventScope.of(), ClubEventScope.of())).toBe(true);
        expect(eventScopesEqual(ExhibitorEventScope.of(), ExhibitorEventScope.of())).toBe(true);
        expect(eventScopesEqual(PlatformEventScope.of(), PlatformEventScope.of())).toBe(true);
    });

    it.each([
        ['club vs exhibitor', ClubEventScope.of(), ExhibitorEventScope.of()],
        ['club vs platform', ClubEventScope.of(), PlatformEventScope.of()],
        ['exhibitor vs platform', ExhibitorEventScope.of(), PlatformEventScope.of()],
    ])('does not equal across kinds (%s)', (_label, a, b) => {
        expect(eventScopesEqual(a, b)).toBe(false);
        expect(eventScopesEqual(b, a)).toBe(false);
    });

    it('treats a rehydrated scope as equal to a freshly built one of the same kind', () => {
        expect(eventScopesEqual(asEventScope('club'), ClubEventScope.of())).toBe(true);
        expect(eventScopesEqual(asEventScope('exhibitor'), ExhibitorEventScope.of())).toBe(true);
        expect(eventScopesEqual(asEventScope('platform'), PlatformEventScope.of())).toBe(true);
    });
});
