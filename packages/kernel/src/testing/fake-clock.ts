// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Clock } from '../domain/domain-ports.js';

export class FakeClock implements Clock {
  private current: number;

  constructor(start: Date = new Date(0)) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  tick(ms: number): void {
    this.current += ms;
  }
}
