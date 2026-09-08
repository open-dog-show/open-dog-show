// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import { FakeEventIdGenerator } from '../../../src/Shared/infrastructure/fake-event-id-generator.js';
import type { EventId } from '../../../src/Shared/domain/domain-ids.js';

describe('FakeEventIdGenerator', () => {
    it('returns deterministic UUIDs starting from seed 1', () => {
        const gen = new FakeEventIdGenerator();

        expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000001');
        expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000002');
        expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000003');
    });

    it('resets counter when reset() is called', () => {
        const gen = new FakeEventIdGenerator();

        gen.generate();
        gen.generate();
        gen.reset();

        expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000001');
    });

    it('accepts a custom starting seed', () => {
        const gen = new FakeEventIdGenerator(10);

        expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000010');
        expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000011');
    });

    it('returns a branded EventId that flows through the port', () => {
        const gen = new FakeEventIdGenerator();

        expectTypeOf(gen.generate()).toEqualTypeOf<EventId>();
    });

    it('produces ids matching the UUID v4 format (version 4, variant 8 nibbles)', () => {
        // The docstring advertises valid UUID v4 format with a fixed version
        // (4) and variant (8) nibble; pin the shape so a refactor that breaks
        // those nibbles while keeping the incrementing counter still fails.
        const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        const gen = new FakeEventIdGenerator();

        expect(gen.generate()).toMatch(UUID_V4);
        expect(gen.generate()).toMatch(UUID_V4);
        expect(new FakeEventIdGenerator(99).generate()).toMatch(UUID_V4);
    });
});
