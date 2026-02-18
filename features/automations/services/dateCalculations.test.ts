import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateRelativeDate } from './dateCalculations';
import type { RelativeDateOption } from '../types';

describe('dateCalculations', () => {
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
});
