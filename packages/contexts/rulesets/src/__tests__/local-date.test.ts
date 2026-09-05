// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, expectTypeOf, it } from 'vitest';
import { LocalDate, InvalidLocalDateError } from '../domain/value-objects/local-date.js';
import { asAgeMonths } from '../domain/value-objects/age-months.js';

describe('LocalDate', () => {
    describe('of — valid construction', () => {
        it('builds a date exposing the supplied year/month/day', () => {
            const date = LocalDate.of(2026, 8, 4);

            expect(date.year).toBe(2026);
            expect(date.month).toBe(8);
            expect(date.day).toBe(4);
        });

        it('returns a LocalDate instance', () => {
            expectTypeOf(LocalDate.of(2026, 1, 1)).toEqualTypeOf<LocalDate>();
            expect(LocalDate.of(2026, 1, 1)).toBeInstanceOf(LocalDate);
        });

        it('accepts the first and last day of the year', () => {
            expect(LocalDate.of(2026, 1, 1).year).toBe(2026);
            expect(LocalDate.of(2026, 12, 31).day).toBe(31);
        });

        it('accepts Feb 29 on a leap year (divisible by 4, not a century)', () => {
            expect(LocalDate.of(2024, 2, 29).day).toBe(29);
        });

        it('accepts Feb 29 on a century leap year (divisible by 400)', () => {
            expect(LocalDate.of(2000, 2, 29).day).toBe(29);
        });

        it('accepts Feb 28 on a non-leap year', () => {
            expect(LocalDate.of(2023, 2, 28).day).toBe(28);
        });

        it('accepts the 30th of a 30-day month', () => {
            expect(LocalDate.of(2026, 4, 30).day).toBe(30);
        });
    });

    describe('of — invalid construction', () => {
        it.each([
            ['month 0', 2026, 0, 1],
            ['month 13', 2026, 13, 1],
        ])('rejects %s', (_label, year, month, day) => {
            expect(() => LocalDate.of(year, month, day)).toThrow(InvalidLocalDateError);
        });

        it.each([
            ['day 0', 2026, 1, 0],
            ['day 32 in a 31-day month', 2026, 1, 32],
            ['day 31 in a 30-day month', 2026, 4, 31],
            ['day 99', 2026, 6, 99],
        ])('rejects %s', (_label, year, month, day) => {
            expect(() => LocalDate.of(year, month, day)).toThrow(InvalidLocalDateError);
        });

        it('rejects Feb 30', () => {
            expect(() => LocalDate.of(2024, 2, 30)).toThrow(InvalidLocalDateError);
        });

        it('rejects Feb 29 on a non-leap year', () => {
            // 2023 is not a leap year; 1900 is a century non-divisible by 400.
            expect(() => LocalDate.of(2023, 2, 29)).toThrow(InvalidLocalDateError);
            expect(() => LocalDate.of(1900, 2, 29)).toThrow(InvalidLocalDateError);
        });

        it.each([
            ['non-integer year', 2026.5, 1, 1],
            ['non-integer month', 2026, 1.5, 1],
            ['non-integer day', 2026, 1, 1.5],
            ['NaN year', Number.NaN, 1, 1],
            ['NaN month', 2026, Number.NaN, 1],
            ['NaN day', 2026, 1, Number.NaN],
        ])('rejects %s', (_label, year, month, day) => {
            expect(() => LocalDate.of(year, month, day)).toThrow(InvalidLocalDateError);
        });
    });

    describe('closed type & immutability (compile-time)', () => {
        it('does not accept a bare object literal where a LocalDate is required', () => {
            // The private fields make LocalDate nominal, so only real
            // LocalDate instances satisfy the type — a bare literal (even one
            // with impossible values) is rejected at compile time. Construction
            // must go through the validating factory LocalDate.of.
            // @ts-expect-error — a bare literal is not a LocalDate
            const date: LocalDate = { year: 2026, month: 13, day: 99 };
            expect(date).toBeDefined();
        });

        it('exposes year/month/day as read-only', () => {
            const date = LocalDate.of(2026, 8, 4);

            // Compile-time: the accessor has no setter, so tsc rejects the
            // assignment. Runtime: strict mode rejects assignment to a
            // getter-only property with a TypeError.
            expect(() => {
                // @ts-expect-error — year is a read-only accessor with no setter
                date.year = 2025;
            }).toThrow();
            expect(date.year).toBe(2026);
        });
    });

    describe('equals — value equality', () => {
        it('is equal when every field matches', () => {
            expect(LocalDate.of(2026, 8, 4).equals(LocalDate.of(2026, 8, 4))).toBe(true);
        });

        it('is not equal when any field differs', () => {
            const date = LocalDate.of(2026, 8, 4);
            expect(date.equals(LocalDate.of(2026, 8, 5))).toBe(false);
            expect(date.equals(LocalDate.of(2026, 9, 4))).toBe(false);
            expect(date.equals(LocalDate.of(2025, 8, 4))).toBe(false);
        });
    });

    describe('isBefore / isAfter', () => {
        it('orders dates across years, months, and days', () => {
            const aug4 = LocalDate.of(2026, 8, 4);
            const aug5 = LocalDate.of(2026, 8, 5);
            const sep4 = LocalDate.of(2026, 9, 4);
            const aug2025 = LocalDate.of(2025, 8, 4);

            expect(aug4.isBefore(aug5)).toBe(true);
            expect(aug5.isBefore(aug4)).toBe(false);
            expect(aug4.isBefore(sep4)).toBe(true);
            expect(aug4.isBefore(aug2025)).toBe(false);

            expect(aug4.isAfter(aug5)).toBe(false);
            expect(aug4.isAfter(aug2025)).toBe(true);
            expect(sep4.isAfter(aug4)).toBe(true);
        });

        it('is neither before nor after itself', () => {
            const date = LocalDate.of(2026, 8, 4);
            expect(date.isBefore(date)).toBe(false);
            expect(date.isAfter(date)).toBe(false);
        });
    });

    describe('completedMonthsSince', () => {
        it('returns the elapsed completed calendar months (same day-of-month)', () => {
            // born 2026-05-04, show 2026-08-04 → 3 completed months
            expect(LocalDate.of(2026, 8, 4).completedMonthsSince(LocalDate.of(2026, 5, 4))).toEqual(
                asAgeMonths(3),
            );
        });

        it('subtracts the current month when its day has not yet been reached', () => {
            // born 2026-05-04, show 2026-08-03 → 2 completed months (day 3 < day 4)
            expect(LocalDate.of(2026, 8, 3).completedMonthsSince(LocalDate.of(2026, 5, 4))).toEqual(
                asAgeMonths(2),
            );
        });

        it('counts across a year boundary', () => {
            // born 2025-12-15, show 2026-02-14 → 1 completed month (day 14 < 15)
            expect(
                LocalDate.of(2026, 2, 14).completedMonthsSince(LocalDate.of(2025, 12, 15)),
            ).toEqual(asAgeMonths(1));
            // born 2025-12-15, show 2026-02-15 → 2 completed months
            expect(
                LocalDate.of(2026, 2, 15).completedMonthsSince(LocalDate.of(2025, 12, 15)),
            ).toEqual(asAgeMonths(2));
        });

        it('returns a negative age when this date is before `from`', () => {
            // show 2026-05-04, born 2026-09-01 → -4 completed months
            // (show day 4 >= birth day 1, so no current-month subtraction)
            expect(LocalDate.of(2026, 5, 4).completedMonthsSince(LocalDate.of(2026, 9, 1))).toEqual(
                asAgeMonths(-4),
            );
        });
    });

    describe('InvalidLocalDateError', () => {
        it('carries the attempted year/month/day and is an Error', () => {
            try {
                LocalDate.of(2026, 13, 99);
                throw new Error('expected LocalDate.of to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(InvalidLocalDateError);
                expect(error).toBeInstanceOf(Error);
                const invalid = error as InvalidLocalDateError;
                expect(invalid.year).toBe(2026);
                expect(invalid.month).toBe(13);
                expect(invalid.day).toBe(99);
                expect(invalid.name).toBe('InvalidLocalDateError');
                expect(invalid.message).toMatch(/Invalid calendar date/);
            }
        });
    });
});
