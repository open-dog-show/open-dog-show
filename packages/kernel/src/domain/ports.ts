// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}
