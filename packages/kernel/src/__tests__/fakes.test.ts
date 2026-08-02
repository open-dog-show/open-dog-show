// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { FakeClock } from '../testing/fake-clock.js';
import { FakeIdGenerator } from '../testing/fake-id-generator.js';

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

describe('FakeIdGenerator', () => {
  it('returns deterministic UUIDs starting from seed 1', () => {
    const gen = new FakeIdGenerator();

    expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000001');
    expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000002');
    expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000003');
  });

  it('resets counter when reset() is called', () => {
    const gen = new FakeIdGenerator();

    gen.generate();
    gen.generate();
    gen.reset();

    expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('accepts a custom starting seed', () => {
    const gen = new FakeIdGenerator(10);

    expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000010');
    expect(gen.generate()).toBe('00000000-0000-4000-8000-000000000011');
  });
});
