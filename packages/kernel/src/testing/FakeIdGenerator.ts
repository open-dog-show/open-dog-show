// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IdGenerator } from '../domain/ports.js';

export class FakeIdGenerator implements IdGenerator {
  private counter: number;
  private readonly seed: number;

  constructor(seed = 1) {
    this.seed = seed;
    this.counter = seed;
  }

  generate(): string {
    const n = this.counter++;
    const suffix = n.toString(10).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  }

  reset(): void {
    this.counter = this.seed;
  }
}
