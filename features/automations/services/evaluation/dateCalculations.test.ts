import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateRelativeDate,
  isWorkingDay,
  calculateWorkingDays,
  countWorkingDaysBetween,
  calculateNextWeekday,
  calculateNextWeekOn,
  calculateDayOfMonth,
  calculateNthWeekdayOfMonth,
  calculateSpecificDate,
} from './dateCalculations';
import type { RelativeDateOption } from '../../types';

describe('dateCalculations', () => {
  describe('isWorkingDay', () => {
    it('returns true for Monday through Friday', () => {
      // Monday, Jan 8, 2024
      expect(isWorkingDay(new Date(2024, 0, 8))).toBe(true);
      // Tuesday
      expect(isWorkingDay(new Date(2024, 0, 9))).toBe(true);
      // Wednesday
      expect(isWorkingDay(new Date(2024, 0, 10))).toBe(true);
      // Thursday
      expect(isWorkingDay(new Date(2024, 0, 11))).toBe(true);
      // Friday
      expect(isWorkingDay(new Date(2024, 0, 12))).toBe(true);
    });

    it('returns false for Saturday and Sunday', () => {
      // Saturday, Jan 13, 2024
      expect(isWorkingDay(new Date(2024, 0, 13))).toBe(false);
      // Sunday, Jan 14, 2024
      expect(isWorkingDay(new Date(2024, 0, 14))).toBe(false);
    });
  });

  describe('calculateWorkingDays', () => {
    it('handles N=0 on a working day by returning that day', () => {
      const monday = new Date(2024, 0, 8); // Monday
      const result = calculateWorkingDays(0, monday);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(8);
      expect(result.getHours()).toBe(0);
    });

    it('handles N=0 on Saturday by returning next Monday', () => {
      const saturday = new Date(2024, 0, 13); // Saturday
      const result = calculateWorkingDays(0, saturday);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15); // Monday
      expect(result.getHours()).toBe(0);
    });

    it('handles N=0 on Sunday by returning next Monday', () => {
      const sunday = new Date(2024, 0, 14); // Sunday
      const result = calculateWorkingDays(0, sunday);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15); // Monday
      expect(result.getHours()).toBe(0);
    });

    it('calculates 1 working day from Monday as Tuesday', () => {
      const monday = new Date(2024, 0, 8);
      const result = calculateWorkingDays(1, monday);
      expect(result.getDate()).toBe(9); // Tuesday
    });

    it('calculates 1 working day from Friday as Monday', () => {
      const friday = new Date(2024, 0, 12);
      const result = calculateWorkingDays(1, friday);
      expect(result.getDate()).toBe(15); // Monday
    });

    it('calculates 5 working days from Monday as next Monday', () => {
      const monday = new Date(2024, 0, 8);
      const result = calculateWorkingDays(5, monday);
      expect(result.getDate()).toBe(15); // Next Monday
    });

    it('skips weekends when calculating working days', () => {
      const thursday = new Date(2024, 0, 11); // Thursday
      const result = calculateWorkingDays(3, thursday);
      // Thu + 1 = Fri, Fri + 1 = Mon (skip weekend), Mon + 1 = Tue
      expect(result.getDate()).toBe(16); // Tuesday
    });
  });

  describe('countWorkingDaysBetween', () => {
    it('returns 0 for adjacent dates', () => {
      const monday = new Date(2024, 0, 8);
      const tuesday = new Date(2024, 0, 9);
      expect(countWorkingDaysBetween(monday, tuesday)).toBe(0);
    });

    it('counts working days between Monday and Friday (exclusive)', () => {
      const monday = new Date(2024, 0, 8);
      const friday = new Date(2024, 0, 12);
      // Tue, Wed, Thu = 3 working days
      expect(countWorkingDaysBetween(monday, friday)).toBe(3);
    });

    it('excludes weekends from count', () => {
      const friday = new Date(2024, 0, 12);
      const monday = new Date(2024, 0, 15);
      // Sat, Sun are not counted
      expect(countWorkingDaysBetween(friday, monday)).toBe(0);
    });

    it('counts working days across a full week', () => {
      const monday1 = new Date(2024, 0, 8);
      const monday2 = new Date(2024, 0, 15);
      // Tue, Wed, Thu, Fri (skip Sat, Sun) = 4 working days (exclusive of both endpoints)
      expect(countWorkingDaysBetween(monday1, monday2)).toBe(4);
    });

    it('returns 0 when from equals to', () => {
      const monday = new Date(2024, 0, 8);
      expect(countWorkingDaysBetween(monday, monday)).toBe(0);
    });
  });

  describe('Property 14: calculateWorkingDays always lands on a working day', () => {
    it('Feature: automations-filters-dates, Property 14: calculateWorkingDays always lands on a working day - Validates: Requirements 5.1, 5.2', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          fc.integer({ min: 0, max: 100 }),
          (inputDate, n) => {
            const result = calculateWorkingDays(n, inputDate);

            // Result must be a working day (Monday-Friday)
            expect(isWorkingDay(result)).toBe(true);

            // Result must be set to start of day (00:00:00.000)
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: countWorkingDaysBetween is consistent with isWorkingDay', () => {
    it('Feature: automations-filters-dates, Property 15: countWorkingDaysBetween is consistent with isWorkingDay - Validates: Requirements 5.3', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          fc.integer({ min: 1, max: 30 }), // Limit range to keep test fast
          (startDate, daysApart) => {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + daysApart);

            const count = countWorkingDaysBetween(startDate, endDate);

            // Manually count working days to verify
            let expectedCount = 0;
            const current = new Date(startDate);
            current.setDate(current.getDate() + 1); // Start from day after (exclusive)

            while (current < endDate) {
              if (isWorkingDay(current)) {
                expectedCount++;
              }
              current.setDate(current.getDate() + 1);
            }

            expect(count).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: Date calculation produces valid weekdays for next_working_day', () => {
    it('Feature: automations-foundation, Property 12: Date calculation produces valid weekdays for next_working_day - Validates: Requirements 7.3, 7.4, 7.5, 7.6', () => {
      fc.assert(
        fc.property(
          // Generate dates within a reasonable range (1970-2100)
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          (inputDate) => {
            const result = calculateRelativeDate('next_working_day', inputDate);

            // (a) Result must be strictly after the input date
            const inputStartOfDay = new Date(inputDate);
            inputStartOfDay.setHours(0, 0, 0, 0);
            expect(result.getTime()).toBeGreaterThan(inputStartOfDay.getTime());

            // (b) Result must fall on Monday through Friday (1-5)
            const dayOfWeek = result.getDay();
            expect(dayOfWeek).toBeGreaterThanOrEqual(1);
            expect(dayOfWeek).toBeLessThanOrEqual(5);

            // (c) Result must be set to start of day (00:00:00.000)
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Date calculation today/tomorrow correctness', () => {
    it('Feature: automations-foundation, Property 13: Date calculation today/tomorrow correctness - Validates: Requirements 7.1, 7.2', () => {
      fc.assert(
        fc.property(
          // Generate dates within a reasonable range (1970-2100)
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          (inputDate) => {
            // Test 'today' option
            const todayResult = calculateRelativeDate('today', inputDate);

            // Should return the start of the same calendar day
            const expectedToday = new Date(inputDate);
            expectedToday.setHours(0, 0, 0, 0);
            expect(todayResult.getTime()).toBe(expectedToday.getTime());

            // Time components must be set to 00:00:00.000
            expect(todayResult.getHours()).toBe(0);
            expect(todayResult.getMinutes()).toBe(0);
            expect(todayResult.getSeconds()).toBe(0);
            expect(todayResult.getMilliseconds()).toBe(0);

            // Test 'tomorrow' option
            const tomorrowResult = calculateRelativeDate('tomorrow', inputDate);

            // Should return the start of the next calendar day
            const expectedTomorrow = new Date(inputDate);
            expectedTomorrow.setHours(0, 0, 0, 0);
            expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
            expect(tomorrowResult.getTime()).toBe(expectedTomorrow.getTime());

            // Time components must be set to 00:00:00.000
            expect(tomorrowResult.getHours()).toBe(0);
            expect(tomorrowResult.getMinutes()).toBe(0);
            expect(tomorrowResult.getSeconds()).toBe(0);
            expect(tomorrowResult.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('calculateNextWeekday', () => {
    it('returns next Monday from a Wednesday', () => {
      const wednesday = new Date(2024, 0, 10); // Jan 10, 2024 (Wed)
      const result = calculateNextWeekday(1, wednesday); // 1 = Monday
      expect(result.getDate()).toBe(15); // Jan 15 (Mon)
      expect(result.getDay()).toBe(1);
    });

    it('returns next Sunday from a Sunday (goes to next week)', () => {
      const sunday = new Date(2024, 0, 14); // Jan 14, 2024 (Sun)
      const result = calculateNextWeekday(0, sunday); // 0 = Sunday
      expect(result.getDate()).toBe(21); // Jan 21 (Sun)
      expect(result.getDay()).toBe(0);
    });

    it('returns next Friday from a Monday', () => {
      const monday = new Date(2024, 0, 8); // Jan 8, 2024 (Mon)
      const result = calculateNextWeekday(5, monday); // 5 = Friday
      expect(result.getDate()).toBe(12); // Jan 12 (Fri)
      expect(result.getDay()).toBe(5);
    });
  });

  describe('calculateNextWeekOn', () => {
    it('returns Monday of next week from a Wednesday', () => {
      const wednesday = new Date(2024, 0, 10); // Jan 10, 2024 (Wed)
      const result = calculateNextWeekOn(1, wednesday); // 1 = Monday
      expect(result.getDate()).toBe(15); // Jan 15 (Mon)
      expect(result.getDay()).toBe(1);
    });

    it('returns Sunday of next week from a Monday', () => {
      const monday = new Date(2024, 0, 8); // Jan 8, 2024 (Mon)
      const result = calculateNextWeekOn(0, monday); // 0 = Sunday
      expect(result.getDate()).toBe(21); // Jan 21 (Sun) - next week's Sunday
      expect(result.getDay()).toBe(0);
    });
  });

  describe('calculateDayOfMonth', () => {
    it('returns the 15th of this month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateDayOfMonth(15, 'this_month', date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0); // January
    });

    it('returns the last day of this month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateDayOfMonth('last', 'this_month', date);
      expect(result.getDate()).toBe(31); // Jan has 31 days
      expect(result.getMonth()).toBe(0);
    });

    it('returns the last working day of this month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateDayOfMonth('last_working', 'this_month', date);
      // Jan 31, 2024 is a Wednesday (working day)
      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(0);
      expect(isWorkingDay(result)).toBe(true);
    });

    it('clamps day 31 to day 30 for April', () => {
      const date = new Date(2024, 3, 10); // Apr 10, 2024
      const result = calculateDayOfMonth(31, 'this_month', date);
      expect(result.getDate()).toBe(30); // April has 30 days
      expect(result.getMonth()).toBe(3);
    });

    it('returns the 15th of next month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateDayOfMonth(15, 'next_month', date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('calculateNthWeekdayOfMonth', () => {
    it('returns the first Monday of this month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateNthWeekdayOfMonth(1, 1, 'this_month', date);
      expect(result.getDate()).toBe(1); // Jan 1, 2024 is a Monday
      expect(result.getDay()).toBe(1);
      expect(result.getMonth()).toBe(0);
    });

    it('returns the last Friday of this month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateNthWeekdayOfMonth('last', 5, 'this_month', date);
      expect(result.getDate()).toBe(26); // Jan 26, 2024 is the last Friday
      expect(result.getDay()).toBe(5);
      expect(result.getMonth()).toBe(0);
    });

    it('returns the third Wednesday of next month', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateNthWeekdayOfMonth(3, 3, 'next_month', date);
      expect(result.getDay()).toBe(3); // Wednesday
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('calculateSpecificDate', () => {
    it('returns December 25th of this year', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024
      const result = calculateSpecificDate(12, 25, date);
      expect(result.getMonth()).toBe(11); // December (0-indexed)
      expect(result.getDate()).toBe(25);
      expect(result.getFullYear()).toBe(2024);
    });

    it('returns February 29th in a leap year', () => {
      const date = new Date(2024, 0, 10); // Jan 10, 2024 (leap year)
      const result = calculateSpecificDate(2, 29, date);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(29);
      expect(result.getFullYear()).toBe(2024);
    });

    it('returns February 28th when requesting Feb 29 in a non-leap year', () => {
      const date = new Date(2023, 0, 10); // Jan 10, 2023 (non-leap year)
      const result = calculateSpecificDate(2, 29, date);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28);
      expect(result.getFullYear()).toBe(2023);
    });

    it('advances to next year if date has already passed', () => {
      const date = new Date(2024, 11, 26); // Dec 26, 2024
      const result = calculateSpecificDate(12, 25, date);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(25);
      expect(result.getFullYear()).toBe(2025); // Next year
    });
  });

  describe('Property 8: calculateNextWeekday always returns the correct next weekday', () => {
    it('Feature: automations-filters-dates, Property 8: calculateNextWeekday always returns the correct next weekday - Validates: Requirements 4.1', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          fc.integer({ min: 0, max: 6 }), // weekday 0-6
          (inputDate, weekday) => {
            const result = calculateNextWeekday(weekday, inputDate);

            // (a) Result must have the correct weekday
            expect(result.getDay()).toBe(weekday);

            // (b) Result must be strictly after the input date
            const inputStartOfDay = new Date(inputDate);
            inputStartOfDay.setHours(0, 0, 0, 0);
            expect(result.getTime()).toBeGreaterThan(inputStartOfDay.getTime());

            // (c) Result must be at most 7 days after the input date
            const maxDate = new Date(inputStartOfDay);
            maxDate.setDate(maxDate.getDate() + 7);
            expect(result.getTime()).toBeLessThanOrEqual(maxDate.getTime());

            // Result must be set to start of day
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: calculateNextWeekOn returns the correct weekday in the following calendar week', () => {
    it('Feature: automations-filters-dates, Property 9: calculateNextWeekOn returns the correct weekday in the following calendar week - Validates: Requirements 4.2', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          fc.integer({ min: 0, max: 6 }), // weekday 0-6
          (inputDate, weekday) => {
            const result = calculateNextWeekOn(weekday, inputDate);

            // (a) Result must have the correct weekday
            expect(result.getDay()).toBe(weekday);

            // (b) Result must fall in the calendar week following the input date's week
            // Find the Monday of the input date's week
            const inputStartOfDay = new Date(inputDate);
            inputStartOfDay.setHours(0, 0, 0, 0);
            const inputDay = inputStartOfDay.getDay();
            const daysToMonday = inputDay === 0 ? -6 : 1 - inputDay;
            const inputWeekMonday = new Date(inputStartOfDay);
            inputWeekMonday.setDate(inputWeekMonday.getDate() + daysToMonday);

            // Find the Monday of the next week
            const nextWeekMonday = new Date(inputWeekMonday);
            nextWeekMonday.setDate(nextWeekMonday.getDate() + 7);

            // Find the Sunday of the next week
            const nextWeekSunday = new Date(nextWeekMonday);
            nextWeekSunday.setDate(nextWeekSunday.getDate() + 6);

            // Result must be within next week's Monday-Sunday range
            expect(result.getTime()).toBeGreaterThanOrEqual(nextWeekMonday.getTime());
            expect(result.getTime()).toBeLessThanOrEqual(nextWeekSunday.getTime());

            // Result must be set to start of day
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: calculateDayOfMonth returns a valid day in the current or next month', () => {
    it('Feature: automations-filters-dates, Property 10: calculateDayOfMonth returns a valid day in the current or next month - Validates: Requirements 4.3, 4.4, 4.5', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          fc.oneof(
            fc.integer({ min: 1, max: 31 }),
            fc.constant('last' as const),
            fc.constant('last_working' as const)
          ),
          fc.constantFrom('this_month' as const, 'next_month' as const),
          (inputDate, day, monthTarget) => {
            const result = calculateDayOfMonth(day, monthTarget, inputDate);

            // Determine expected month
            const expectedMonth =
              monthTarget === 'this_month'
                ? inputDate.getMonth()
                : (inputDate.getMonth() + 1) % 12;

            // (a) Result must fall within the specified month
            expect(result.getMonth()).toBe(expectedMonth);

            // (b) If numeric day, result must be clamped to valid range
            if (typeof day === 'number') {
              const lastDayOfMonth = new Date(
                result.getFullYear(),
                result.getMonth() + 1,
                0
              ).getDate();
              expect(result.getDate()).toBeLessThanOrEqual(lastDayOfMonth);
              expect(result.getDate()).toBe(Math.min(day, lastDayOfMonth));
            }

            // (c) If 'last_working', result must be a working day
            if (day === 'last_working') {
              expect(isWorkingDay(result)).toBe(true);
            }

            // Result must be set to start of day
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: calculateNthWeekdayOfMonth returns the correct nth weekday', () => {
    it('Feature: automations-filters-dates, Property 11: calculateNthWeekdayOfMonth returns the correct nth weekday - Validates: Requirements 4.6', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          fc.oneof(
            fc.integer({ min: 1, max: 4 }),
            fc.constant('last' as const)
          ),
          fc.integer({ min: 0, max: 6 }), // weekday 0-6
          fc.constantFrom('this_month' as const, 'next_month' as const),
          (inputDate, nth, weekday, monthTarget) => {
            const result = calculateNthWeekdayOfMonth(nth, weekday, monthTarget, inputDate);

            // Determine expected month
            const expectedMonth =
              monthTarget === 'this_month'
                ? inputDate.getMonth()
                : (inputDate.getMonth() + 1) % 12;

            // (a) Result must have the correct weekday
            expect(result.getDay()).toBe(weekday);

            // (b) Result must fall within the specified month
            expect(result.getMonth()).toBe(expectedMonth);

            // (c) Verify it's the nth occurrence (or last)
            // Count occurrences of this weekday in the month
            const firstOfMonth = new Date(result.getFullYear(), result.getMonth(), 1);
            const occurrences: Date[] = [];
            const current = new Date(firstOfMonth);

            while (current.getMonth() === result.getMonth()) {
              if (current.getDay() === weekday) {
                occurrences.push(new Date(current));
              }
              current.setDate(current.getDate() + 1);
            }

            if (nth === 'last') {
              expect(result.getTime()).toBe(
                occurrences[occurrences.length - 1].getTime()
              );
            } else {
              // If nth occurrence exists, verify it matches
              if (occurrences.length >= nth) {
                expect(result.getTime()).toBe(occurrences[nth - 1].getTime());
              } else {
                // If nth doesn't exist, should return last occurrence
                expect(result.getTime()).toBe(
                  occurrences[occurrences.length - 1].getTime()
                );
              }
            }

            // Result must be set to start of day
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: calculateSpecificDate returns the correct month and day', () => {
    it('Feature: automations-filters-dates, Property 12: calculateSpecificDate returns the correct month and day - Validates: Requirements 4.7, 4.8', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          fc.integer({ min: 1, max: 12 }), // month 1-12
          fc.integer({ min: 1, max: 31 }), // day 1-31
          (inputDate, month, day) => {
            const result = calculateSpecificDate(month, day, inputDate);

            // (a) Result must have the requested month (or Feb 28 for Feb 29 in non-leap year)
            expect(result.getMonth()).toBe(month - 1); // getMonth is 0-indexed

            // (b) Result must be on or after the input date
            const inputStartOfDay = new Date(inputDate);
            inputStartOfDay.setHours(0, 0, 0, 0);
            expect(result.getTime()).toBeGreaterThanOrEqual(inputStartOfDay.getTime());

            // (c) Handle Feb 29 in non-leap years
            const isLeapYear = (year: number) =>
              (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

            if (month === 2 && day === 29 && !isLeapYear(result.getFullYear())) {
              expect(result.getDate()).toBe(28);
            } else {
              // Clamp to last day of month if day exceeds month length
              const lastDayOfMonth = new Date(
                result.getFullYear(),
                month,
                0
              ).getDate();
              expect(result.getDate()).toBe(Math.min(day, lastDayOfMonth));
            }

            // Result must be set to start of day
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: All date calculations produce midnight timestamps', () => {
    it('Feature: automations-filters-dates, Property 13: All date calculations produce midnight timestamps - Validates: Requirements 4.10', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31') }),
          (inputDate) => {
            // Test all date calculation functions
            const results = [
              calculateNextWeekday(1, inputDate),
              calculateNextWeekOn(1, inputDate),
              calculateDayOfMonth(15, 'this_month', inputDate),
              calculateNthWeekdayOfMonth(1, 1, 'this_month', inputDate),
              calculateSpecificDate(12, 25, inputDate),
              calculateWorkingDays(5, inputDate),
            ];

            // All results must have midnight timestamps
            results.forEach((result) => {
              expect(result.getHours()).toBe(0);
              expect(result.getMinutes()).toBe(0);
              expect(result.getSeconds()).toBe(0);
              expect(result.getMilliseconds()).toBe(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

  describe('calculateRelativeDate - new date options', () => {
    describe('next weekday options', () => {
      it('calculates next_monday correctly', () => {
        const wednesday = new Date(2024, 0, 10); // Jan 10, 2024 (Wed)
        const result = calculateRelativeDate('next_monday', wednesday);
        expect(result.getDate()).toBe(15); // Jan 15 (Mon)
        expect(result.getDay()).toBe(1);
      });

      it('calculates next_friday correctly', () => {
        const monday = new Date(2024, 0, 8); // Jan 8, 2024 (Mon)
        const result = calculateRelativeDate('next_friday', monday);
        expect(result.getDate()).toBe(12); // Jan 12 (Fri)
        expect(result.getDay()).toBe(5);
      });
    });

    describe('next week options', () => {
      it('calculates next_week_monday correctly', () => {
        const wednesday = new Date(2024, 0, 10); // Jan 10, 2024 (Wed)
        const result = calculateRelativeDate('next_week_monday', wednesday);
        expect(result.getDate()).toBe(15); // Jan 15 (Mon)
        expect(result.getDay()).toBe(1);
      });

      it('calculates next_week_sunday correctly', () => {
        const monday = new Date(2024, 0, 8); // Jan 8, 2024 (Mon)
        const result = calculateRelativeDate('next_week_sunday', monday);
        expect(result.getDate()).toBe(21); // Jan 21 (Sun)
        expect(result.getDay()).toBe(0);
      });
    });

    describe('day of month options', () => {
      it('calculates day_of_month_15 correctly', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('day_of_month_15', date);
        expect(result.getDate()).toBe(15);
        expect(result.getMonth()).toBe(0);
      });

      it('calculates last_day_of_month correctly', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('last_day_of_month', date);
        expect(result.getDate()).toBe(31);
        expect(result.getMonth()).toBe(0);
      });

      it('calculates last_working_day_of_month correctly', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('last_working_day_of_month', date);
        expect(result.getDate()).toBe(31); // Jan 31, 2024 is a Wednesday
        expect(isWorkingDay(result)).toBe(true);
      });

      it('respects monthTarget parameter for day of month', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('day_of_month_15', date, {
          monthTarget: 'next_month',
        });
        expect(result.getDate()).toBe(15);
        expect(result.getMonth()).toBe(1); // February
      });
    });

    describe('nth weekday of month options', () => {
      it('calculates first_monday_of_month correctly', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('first_monday_of_month', date);
        expect(result.getDate()).toBe(1); // Jan 1, 2024 is a Monday
        expect(result.getDay()).toBe(1);
      });

      it('calculates last_friday_of_month correctly', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('last_friday_of_month', date);
        expect(result.getDate()).toBe(26); // Jan 26, 2024 is the last Friday
        expect(result.getDay()).toBe(5);
      });

      it('respects monthTarget parameter for nth weekday', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('first_monday_of_month', date, {
          monthTarget: 'next_month',
        });
        expect(result.getDay()).toBe(1);
        expect(result.getMonth()).toBe(1); // February
      });
    });

    describe('specific_date option', () => {
      it('calculates specific_date correctly', () => {
        const date = new Date(2024, 0, 10); // Jan 10, 2024
        const result = calculateRelativeDate('specific_date', date, {
          specificMonth: 12,
          specificDay: 25,
        });
        expect(result.getMonth()).toBe(11); // December (0-indexed)
        expect(result.getDate()).toBe(25);
      });

      it('throws error when specific_date is used without parameters', () => {
        const date = new Date(2024, 0, 10);
        expect(() => calculateRelativeDate('specific_date', date)).toThrow(
          'specific_date option requires specificMonth and specificDay parameters'
        );
      });

      it('throws error when specific_date is missing specificMonth', () => {
        const date = new Date(2024, 0, 10);
        expect(() =>
          calculateRelativeDate('specific_date', date, { specificDay: 25 })
        ).toThrow(
          'specific_date option requires specificMonth and specificDay parameters'
        );
      });
    });

    describe('all new options produce midnight timestamps', () => {
      it('ensures all new date options return midnight timestamps', () => {
        const date = new Date(2024, 0, 10, 14, 30, 45, 123); // Jan 10, 2024 at 2:30:45.123 PM

        const options: RelativeDateOption[] = [
          'next_monday',
          'next_week_monday',
          'day_of_month_15',
          'last_day_of_month',
          'first_monday_of_month',
          'last_friday_of_month',
        ];

        options.forEach((option) => {
          const result = calculateRelativeDate(option, date);
          expect(result.getHours()).toBe(0);
          expect(result.getMinutes()).toBe(0);
          expect(result.getSeconds()).toBe(0);
          expect(result.getMilliseconds()).toBe(0);
        });
      });
    });
  });
