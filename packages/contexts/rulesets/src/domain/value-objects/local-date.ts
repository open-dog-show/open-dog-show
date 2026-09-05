// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { asAgeMonths } from './age-months.js';
import type { AgeMonths } from './age-months.js';

/**
 * Thrown by {@link LocalDate.of} when the requested calendar date is not a real
 * Gregorian date. Follows the existing domain-error style
 * (cf. `InvalidProviderClaimsError`).
 */
export class InvalidLocalDateError extends Error {
    readonly year: number;
    readonly month: number;
    readonly day: number;

    constructor(year: number, month: number, day: number, reason: string) {
        super(`Invalid calendar date { year: ${year}, month: ${month}, day: ${day} }: ${reason}`);
        this.name = 'InvalidLocalDateError';
        this.year = year;
        this.month = month;
        this.day = day;
    }
}

/**
 * A calendar date without time or timezone — not a JavaScript {@link Date}.
 * Age eligibility for class entry is evaluated against a LocalDate on the show
 * day (FCI 2026; KMSH ART.23).
 *
 * A value object: the only way to obtain an instance is the {@link LocalDate.of}
 * static factory, which validates the calendar date and throws
 * {@link InvalidLocalDateError} for impossible dates (e.g. month 13, day 99,
 * Feb 30). The private constructor and private fields make the class nominal, so
 * a bare object literal `{ year, month, day }` is *not* assignable to
 * `LocalDate` — the type is closed against unvalidated construction. Instances
 * are immutable and compared by value with {@link LocalDate.equals}.
 */
export class LocalDate {
    readonly #date: Date;
    readonly #ms: number;

    private constructor(year: number, month: number, day: number) {
        // Construct a UTC instant from the calendar fields and round-trip check
        // it. Date.UTC normalises overflow (month 13, day 99, Feb 30 roll
        // forward; NaN/non-integers yield an Invalid Date), so any mismatch with
        // the inputs means the requested date is not a real Gregorian calendar
        // date. UTC is used rather than the local-time `new Date(year, month,
        // day)` so the instant is timezone-free — LocalDate exposes no time or
        // timezone, and a future serialisation (e.g. toISOString) won't shift the
        // calendar day across host timezones.
        const date = new Date(Date.UTC(year, month - 1, day));
        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            throw new InvalidLocalDateError(year, month, day, 'not a real Gregorian calendar date');
        }
        this.#date = date;
        this.#ms = date.getTime();
    }

    /** The calendar year. */
    get year(): number {
        return this.#date.getUTCFullYear();
    }
    /** The calendar month, 1..12. */
    get month(): number {
        return this.#date.getUTCMonth() + 1;
    }
    /** The calendar day, 1..days in the month. */
    get day(): number {
        return this.#date.getUTCDate();
    }

    /**
     * Validating factory — the public way to construct a {@link LocalDate}.
     * Delegates to the private constructor, which transforms the year/month/day
     * into a UTC instant and rejects impossible calendar dates (e.g. month 13,
     * day 99, Feb 30) by throwing {@link InvalidLocalDateError}.
     *
     * @param year  Integer calendar year (any integer; the calendar is
     *              Gregorian, not an astronomical or proleptic range).
     * @param month Integer month, 1..12.
     * @param day   Integer day, 1..days in the month.
     */
    static of(year: number, month: number, day: number): LocalDate {
        return new LocalDate(year, month, day);
    }

    /** Value equality — two LocalDate instances are equal iff they denote the same calendar day. */
    equals(other: LocalDate): boolean {
        return this.#ms === other.#ms;
    }

    /** True when this date is strictly before `other` on the calendar. */
    isBefore(other: LocalDate): boolean {
        return this.#ms < other.#ms;
    }

    /** True when this date is strictly after `other` on the calendar. */
    isAfter(other: LocalDate): boolean {
        return this.#ms > other.#ms;
    }

    /**
     * Completed calendar months elapsed from `from` up to this date — the
     * age-in-months unit (ADR-0008). A dog born on the 4th reaches the next
     * month-age on the 4th of the subsequent month: when this date's day is
     * earlier than `from`'s day the current month is not yet complete and is
     * subtracted (FCI 2026; KMSH ART.23).
     *
     * @example showDate.completedMonthsSince(dateOfBirth)
     */
    completedMonthsSince(from: LocalDate): AgeMonths {
        const months = (this.year - from.year) * 12 + (this.month - from.month);
        return asAgeMonths(this.day < from.day ? months - 1 : months);
    }
}
