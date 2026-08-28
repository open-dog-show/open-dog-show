// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { FakeUserIdGenerator } from '../testing/fake-user-id-generator.js';

describe('FakeUserIdGenerator', () => {
    it('mints sequential ids with the default prefix', () => {
        const gen = new FakeUserIdGenerator();

        expect(gen.generate()).toBe('user-1');
        expect(gen.generate()).toBe('user-2');
        expect(gen.generate()).toBe('user-3');
    });

    it('accepts a custom prefix', () => {
        const gen = new FakeUserIdGenerator('acct');

        expect(gen.generate()).toBe('acct-1');
        expect(gen.generate()).toBe('acct-2');
    });
});
