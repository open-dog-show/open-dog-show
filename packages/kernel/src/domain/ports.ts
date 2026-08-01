// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}
