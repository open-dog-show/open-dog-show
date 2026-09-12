// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../../../src/Shared/infrastructure/persistence/inmemory/fake-clock.js';

describe('FakeClock', () => {
    it('returns the fixed date on every call', () => {
        const fixed = new Date('2026-01-01T00:00:00.000Z');
        const clock = new FakeClock(fixed);

        expect(clock.now()).toStrictEqual(fixed);
        expect(clock.now()).toStrictEqual(fixed);
    });

    it('advances when tick() is called', () => {
        const fixed = new Date('2026-01-01T00:00:00.000Z');
        const clock = new FakeClock(fixed);

        clock.tick(1000);

        expect(clock.now()).toStrictEqual(new Date('2026-01-01T00:00:01.000Z'));
    });

    it('accumulates multiple ticks', () => {
        const fixed = new Date('2026-01-01T00:00:00.000Z');
        const clock = new FakeClock(fixed);

        clock.tick(500);
        clock.tick(500);

        expect(clock.now()).toStrictEqual(new Date('2026-01-01T00:00:01.000Z'));
    });
});
