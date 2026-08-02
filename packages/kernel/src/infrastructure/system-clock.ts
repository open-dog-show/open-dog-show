// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Clock } from '../domain/domain-ports.js';

/** Production {@link Clock} backed by `Date.now()`. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
