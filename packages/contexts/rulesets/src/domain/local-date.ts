// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A calendar date without time or timezone — not a JavaScript {@link Date}.
 * Age eligibility for class entry is evaluated against a LocalDate on the
 * show day (FCI 2026; KMSH ART.23).
 */
export interface LocalDate {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}
