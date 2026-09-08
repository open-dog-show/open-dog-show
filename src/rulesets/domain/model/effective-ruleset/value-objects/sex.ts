// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A dog's biological sex — the single vocabulary used wherever sex is recorded
 * (per-sex class judging streams, collective-competition entries). FCI
 * terminology maps "dog" = male, "bitch" = female; the platform uses the
 * neutral `male` / `female` literals everywhere so the two surfaces never
 * diverge.
 */
export type Sex = 'male' | 'female';
