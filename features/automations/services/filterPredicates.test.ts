import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Task } from '@/lib/schemas';
import type { CardFilter } from '../types';
import {
  evaluateFilter,
  evaluateFilters,
  filterPredicateMap,
  type FilterContext,
} from './filterPredicates';

// ============================================================================
// Fast-check Arbitraries
// ============================================================================

/**
 * Arbitrary for generating random Task objects with varied properties.
 */
const arbTask = fc.record({
  id: fc.string(),
  projectId: fc.string(),
  parentTaskId: fc.constantFrom(null, fc.string()),
  sectionId: fc.string(),
  description: fc.string(),
  notes: fc.string(),
  assignee: fc.string(),
  priority: fc.constantFrom('none', 'low', 'medium', 'high'),
  tags: fc.array(fc.string()),
  dueDate: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  completed: fc.boolean(),
  completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  order: fc.integer(),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
}) as fc.Arbitrary<Task>;

/**
 * Arbitrary for generating random FilterContext with varied reference dates.
 */
const arbFilterContext = fc.record({
  now: fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }),
}) as fc.Arbitrary<FilterContext>;

/**
 * Arbitrary for generating section filter types.
 */
const arbSectionFilter = fc.record({
  type: fc.constantFrom('in_section', 'not_in_section'),
  sectionId: fc.string().filter((s) => s.length > 0),
}) as fc.Arbitrary<CardFilter>;

/**
 * Arbitrary for generating simple date filters (no configuration).
 */
const arbSimpleDateFilter = fc.record({
  type: fc.constantFrom(
    'has_due_date',
    'no_due_date',
    'is_overdue',
    'due_today',
    'due_tomorrow',
    'due_this_week',
    'due_next_week',
    'due_this_month',
    'due_next_month',
    'not_due_today',
    'not_due_tomorrow',
    'not_due_this_week',
    'not_due_next_week',
    'not_due_this_month',
    'not_due_next_month'
  ),
}) as fc.Arbitrary<CardFilter>;

/**
 * Arbitrary for generating comparison date filters.
 */
const arbComparisonFilter = fc
  .record({
    type: fc.constantFrom('due_in_less_than', 'due_in_more_than', 'due_in_exactly'),
    value: fc.integer({ min: 1, max: 30 }),
    unit: fc.constantFrom('days', 'working_days'),
  })
  .map((obj) => obj as CardFilter);

/**
 * Arbitrary for generating between date filters.
 */
const arbBetweenFilter = fc
  .record({
    minValue: fc.integer({ min: 1, max: 20 }),
    maxValue: fc.integer({ min: 1, max: 30 }),
    unit: fc.constantFrom('days', 'working_days'),
  })
  .filter((obj) => obj.minValue <= obj.maxValue)
  .map((obj) => ({ type: 'due_in_between' as const, ...obj })) as fc.Arbitrary<CardFilter>;

/**
 * Arbitrary for generating any valid CardFilter.
 */
const arbCardFilter = fc.oneof(
  arbSectionFilter,
  arbSimpleDateFilter,
  arbComparisonFilter,
  arbBetweenFilter
);

// ============================================================================
// Property 2: Section filter predicates are consistent with section membership
// **Validates: Requirements 2.1, 2.2**
// ============================================================================

describe('Property 2: Section filter predicates are consistent with section membership', () => {
  it('Feature: automations-filters-dates, Property 2: Section filter predicates are consistent with section membership - Validates: Requirements 2.1, 2.2', () => {
    fc.assert(
      fc.property(arbTask, fc.string().filter((s) => s.length > 0), arbFilterContext, (task, sectionId, ctx) => {
        const inSectionFilter: CardFilter = { type: 'in_section', sectionId };
        const notInSectionFilter: CardFilter = { type: 'not_in_section', sectionId };

        const inResult = evaluateFilter(inSectionFilter, task, ctx);
        const notInResult = evaluateFilter(notInSectionFilter, task, ctx);

        // in_section returns true iff task.sectionId === filter.sectionId
        expect(inResult).toBe(task.sectionId === sectionId);

        // not_in_section is the logical negation of in_section
        expect(notInResult).toBe(!inResult);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Due date presence filters are complementary
// **Validates: Requirements 2.3, 2.4**
// ============================================================================

describe('Property 3: Due date presence filters are complementary', () => {
  it('Feature: automations-filters-dates, Property 3: Due date presence filters are complementary - Validates: Requirements 2.3, 2.4', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const hasDueDateFilter: CardFilter = { type: 'has_due_date' };
        const noDueDateFilter: CardFilter = { type: 'no_due_date' };

        const hasResult = evaluateFilter(hasDueDateFilter, task, ctx);
        const noResult = evaluateFilter(noDueDateFilter, task, ctx);

        // has_due_date returns true iff dueDate is not null
        expect(hasResult).toBe(task.dueDate !== null);

        // no_due_date is the logical negation of has_due_date
        expect(noResult).toBe(!hasResult);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: Overdue filter matches only incomplete tasks with past due dates
// **Validates: Requirements 2.5**
// ============================================================================

describe('Property 4: Overdue filter matches only incomplete tasks with past due dates', () => {
  it('Feature: automations-filters-dates, Property 4: Overdue filter matches only incomplete tasks with past due dates - Validates: Requirements 2.5', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const overdueFilter: CardFilter = { type: 'is_overdue' };
        const result = evaluateFilter(overdueFilter, task, ctx);

        // is_overdue returns true iff:
        // 1. task has a non-null dueDate
        // 2. dueDate is before ctx.now
        // 3. task is not completed
        const expectedResult =
          task.dueDate !== null &&
          new Date(task.dueDate) < ctx.now &&
          !task.completed;

        expect(result).toBe(expectedResult);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: Relative date range filters match correct time boundaries
// **Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17**
// ============================================================================

describe('Property 5: Relative date range filters match correct time boundaries', () => {
  /**
   * Helper: Check if a date falls within the same calendar day.
   */
  function isSameDay(date: Date, reference: Date): boolean {
    return (
      date.getFullYear() === reference.getFullYear() &&
      date.getMonth() === reference.getMonth() &&
      date.getDate() === reference.getDate()
    );
  }

  /**
   * Helper: Get the start of the next calendar day.
   */
  function getNextDay(reference: Date): Date {
    const result = new Date(reference);
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Helper: Check if a date falls within the same calendar week (Monday-Sunday).
   */
  function isSameWeek(date: Date, reference: Date): boolean {
    const getMonday = (d: Date): Date => {
      const result = new Date(d);
      const day = result.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      result.setDate(result.getDate() + diff);
      result.setHours(0, 0, 0, 0);
      return result;
    };

    const mondayOfDate = getMonday(date);
    const mondayOfReference = getMonday(reference);

    return mondayOfDate.getTime() === mondayOfReference.getTime();
  }

  /**
   * Helper: Get the Monday of the next calendar week.
   */
  function getNextWeekMonday(reference: Date): Date {
    const result = new Date(reference);
    const day = result.getDay();
    const daysToNextMonday = day === 0 ? 1 : 8 - day;
    result.setDate(result.getDate() + daysToNextMonday);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Helper: Get the Sunday of the next calendar week.
   */
  function getNextWeekSunday(reference: Date): Date {
    const nextMonday = getNextWeekMonday(reference);
    const result = new Date(nextMonday);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Helper: Check if a date falls within the same calendar month.
   */
  function isSameMonth(date: Date, reference: Date): boolean {
    return (
      date.getFullYear() === reference.getFullYear() &&
      date.getMonth() === reference.getMonth()
    );
  }

  /**
   * Helper: Get the first day of the next calendar month.
   */
  function getNextMonthStart(reference: Date): Date {
    const result = new Date(reference);
    result.setMonth(result.getMonth() + 1, 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Helper: Get the last day of the next calendar month.
   */
  function getNextMonthEnd(reference: Date): Date {
    const result = new Date(reference);
    result.setMonth(result.getMonth() + 2, 0);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  it('Feature: automations-filters-dates, Property 5: due_today matches same calendar day - Validates: Requirements 2.6', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const filter: CardFilter = { type: 'due_today' };
        const result = evaluateFilter(filter, task, ctx);

        if (task.dueDate === null) {
          expect(result).toBe(false);
        } else {
          const dueDate = new Date(task.dueDate);
          expect(result).toBe(isSameDay(dueDate, ctx.now));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: due_tomorrow matches next calendar day - Validates: Requirements 2.7', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const filter: CardFilter = { type: 'due_tomorrow' };
        const result = evaluateFilter(filter, task, ctx);

        if (task.dueDate === null) {
          expect(result).toBe(false);
        } else {
          const dueDate = new Date(task.dueDate);
          const tomorrow = getNextDay(ctx.now);
          expect(result).toBe(isSameDay(dueDate, tomorrow));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: due_this_week matches same calendar week - Validates: Requirements 2.8', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const filter: CardFilter = { type: 'due_this_week' };
        const result = evaluateFilter(filter, task, ctx);

        if (task.dueDate === null) {
          expect(result).toBe(false);
        } else {
          const dueDate = new Date(task.dueDate);
          expect(result).toBe(isSameWeek(dueDate, ctx.now));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: due_next_week matches next calendar week - Validates: Requirements 2.9', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const filter: CardFilter = { type: 'due_next_week' };
        const result = evaluateFilter(filter, task, ctx);

        if (task.dueDate === null) {
          expect(result).toBe(false);
        } else {
          const dueDate = new Date(task.dueDate);
          const nextWeekMonday = getNextWeekMonday(ctx.now);
          const nextWeekSunday = getNextWeekSunday(ctx.now);
          expect(result).toBe(dueDate >= nextWeekMonday && dueDate <= nextWeekSunday);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: due_this_month matches same calendar month - Validates: Requirements 2.10', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const filter: CardFilter = { type: 'due_this_month' };
        const result = evaluateFilter(filter, task, ctx);

        if (task.dueDate === null) {
          expect(result).toBe(false);
        } else {
          const dueDate = new Date(task.dueDate);
          expect(result).toBe(isSameMonth(dueDate, ctx.now));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: due_next_month matches next calendar month - Validates: Requirements 2.11', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const filter: CardFilter = { type: 'due_next_month' };
        const result = evaluateFilter(filter, task, ctx);

        if (task.dueDate === null) {
          expect(result).toBe(false);
        } else {
          const dueDate = new Date(task.dueDate);
          const nextMonthStart = getNextMonthStart(ctx.now);
          const nextMonthEnd = getNextMonthEnd(ctx.now);
          expect(result).toBe(dueDate >= nextMonthStart && dueDate <= nextMonthEnd);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: not_due_today is negation of due_today (including null) - Validates: Requirements 2.12', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const posFilter: CardFilter = { type: 'due_today' };
        const negFilter: CardFilter = { type: 'not_due_today' };

        const posResult = evaluateFilter(posFilter, task, ctx);
        const negResult = evaluateFilter(negFilter, task, ctx);

        // not_due_today returns true when dueDate is null OR when due_today is false
        if (task.dueDate === null) {
          expect(negResult).toBe(true);
        } else {
          expect(negResult).toBe(!posResult);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: not_due_tomorrow is negation of due_tomorrow (including null) - Validates: Requirements 2.13', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const posFilter: CardFilter = { type: 'due_tomorrow' };
        const negFilter: CardFilter = { type: 'not_due_tomorrow' };

        const posResult = evaluateFilter(posFilter, task, ctx);
        const negResult = evaluateFilter(negFilter, task, ctx);

        if (task.dueDate === null) {
          expect(negResult).toBe(true);
        } else {
          expect(negResult).toBe(!posResult);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: not_due_this_week is negation of due_this_week (including null) - Validates: Requirements 2.14', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const posFilter: CardFilter = { type: 'due_this_week' };
        const negFilter: CardFilter = { type: 'not_due_this_week' };

        const posResult = evaluateFilter(posFilter, task, ctx);
        const negResult = evaluateFilter(negFilter, task, ctx);

        if (task.dueDate === null) {
          expect(negResult).toBe(true);
        } else {
          expect(negResult).toBe(!posResult);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: not_due_next_week is negation of due_next_week (including null) - Validates: Requirements 2.15', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const posFilter: CardFilter = { type: 'due_next_week' };
        const negFilter: CardFilter = { type: 'not_due_next_week' };

        const posResult = evaluateFilter(posFilter, task, ctx);
        const negResult = evaluateFilter(negFilter, task, ctx);

        if (task.dueDate === null) {
          expect(negResult).toBe(true);
        } else {
          expect(negResult).toBe(!posResult);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: not_due_this_month is negation of due_this_month (including null) - Validates: Requirements 2.16', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const posFilter: CardFilter = { type: 'due_this_month' };
        const negFilter: CardFilter = { type: 'not_due_this_month' };

        const posResult = evaluateFilter(posFilter, task, ctx);
        const negResult = evaluateFilter(negFilter, task, ctx);

        if (task.dueDate === null) {
          expect(negResult).toBe(true);
        } else {
          expect(negResult).toBe(!posResult);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 5: not_due_next_month is negation of due_next_month (including null) - Validates: Requirements 2.17', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const posFilter: CardFilter = { type: 'due_next_month' };
        const negFilter: CardFilter = { type: 'not_due_next_month' };

        const posResult = evaluateFilter(posFilter, task, ctx);
        const negResult = evaluateFilter(negFilter, task, ctx);

        if (task.dueDate === null) {
          expect(negResult).toBe(true);
        } else {
          expect(negResult).toBe(!posResult);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: Comparison date filters evaluate correctly against N units
// **Validates: Requirements 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24**
// ============================================================================

describe('Property 6: Comparison date filters evaluate correctly against N units', () => {
  it('Feature: automations-filters-dates, Property 6: due_in_less_than with days - Validates: Requirements 2.18', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 30 }),
        (task, ctx, n) => {
          const filter: CardFilter = { type: 'due_in_less_than', value: n, unit: 'days' };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const nowStart = new Date(ctx.now);
            nowStart.setHours(0, 0, 0, 0);

            const targetDate = new Date(ctx.now);
            targetDate.setHours(0, 0, 0, 0);
            targetDate.setDate(targetDate.getDate() + n);

            // Due date must be after now and before or on the target date
            const expectedResult = dueDate > nowStart && dueDate <= targetDate;
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_more_than with days - Validates: Requirements 2.20', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 30 }),
        (task, ctx, n) => {
          const filter: CardFilter = { type: 'due_in_more_than', value: n, unit: 'days' };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const targetDate = new Date(ctx.now);
            targetDate.setHours(0, 0, 0, 0);
            targetDate.setDate(targetDate.getDate() + n);

            // Due date must be after the target date
            const expectedResult = dueDate > targetDate;
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_exactly with days - Validates: Requirements 2.22', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 30 }),
        (task, ctx, n) => {
          const filter: CardFilter = { type: 'due_in_exactly', value: n, unit: 'days' };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const targetDate = new Date(ctx.now);
            targetDate.setHours(0, 0, 0, 0);
            targetDate.setDate(targetDate.getDate() + n);

            const expectedResult = dueDate.getTime() === targetDate.getTime();
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_between with days - Validates: Requirements 2.24', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 30 }),
        (task, ctx, minValue, maxValue) => {
          // Ensure minValue <= maxValue
          if (minValue > maxValue) {
            [minValue, maxValue] = [maxValue, minValue];
          }

          const filter: CardFilter = {
            type: 'due_in_between',
            minValue,
            maxValue,
            unit: 'days',
          };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const minDate = new Date(ctx.now);
            minDate.setHours(0, 0, 0, 0);
            minDate.setDate(minDate.getDate() + minValue);

            const maxDate = new Date(ctx.now);
            maxDate.setHours(0, 0, 0, 0);
            maxDate.setDate(maxDate.getDate() + maxValue);

            const expectedResult = dueDate >= minDate && dueDate <= maxDate;
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_less_than with working_days - Validates: Requirements 2.19', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 15 }),
        (task, ctx, n) => {
          const filter: CardFilter = { type: 'due_in_less_than', value: n, unit: 'working_days' };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            // Calculate N working days from now
            const nowStart = new Date(ctx.now);
            nowStart.setHours(0, 0, 0, 0);

            // Manually count working days to find the target date
            let count = 0;
            const targetDate = new Date(nowStart);
            while (count < n) {
              targetDate.setDate(targetDate.getDate() + 1);
              const day = targetDate.getDay();
              if (day !== 0 && day !== 6) {
                count++;
              }
            }

            const expectedResult = dueDate > nowStart && dueDate <= targetDate;
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_more_than with working_days - Validates: Requirements 2.21', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 15 }),
        (task, ctx, n) => {
          const filter: CardFilter = { type: 'due_in_more_than', value: n, unit: 'working_days' };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            // Calculate N working days from now
            const nowStart = new Date(ctx.now);
            nowStart.setHours(0, 0, 0, 0);

            let count = 0;
            const targetDate = new Date(nowStart);
            while (count < n) {
              targetDate.setDate(targetDate.getDate() + 1);
              const day = targetDate.getDay();
              if (day !== 0 && day !== 6) {
                count++;
              }
            }

            const expectedResult = dueDate > targetDate;
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_exactly with working_days - Validates: Requirements 2.23', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 15 }),
        (task, ctx, n) => {
          const filter: CardFilter = { type: 'due_in_exactly', value: n, unit: 'working_days' };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            // Calculate N working days from now
            const nowStart = new Date(ctx.now);
            nowStart.setHours(0, 0, 0, 0);

            let count = 0;
            const targetDate = new Date(nowStart);
            while (count < n) {
              targetDate.setDate(targetDate.getDate() + 1);
              const day = targetDate.getDay();
              if (day !== 0 && day !== 6) {
                count++;
              }
            }

            const expectedResult = dueDate.getTime() === targetDate.getTime();
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 6: due_in_between with working_days - Validates: Requirements 2.19, 2.21', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 15 }),
        (task, ctx, minValue, maxValue) => {
          if (minValue > maxValue) {
            [minValue, maxValue] = [maxValue, minValue];
          }

          const filter: CardFilter = {
            type: 'due_in_between',
            minValue,
            maxValue,
            unit: 'working_days',
          };
          const result = evaluateFilter(filter, task, ctx);

          if (task.dueDate === null) {
            expect(result).toBe(false);
          } else {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const nowStart = new Date(ctx.now);
            nowStart.setHours(0, 0, 0, 0);

            // Calculate minValue working days
            let count = 0;
            const minDate = new Date(nowStart);
            while (count < minValue) {
              minDate.setDate(minDate.getDate() + 1);
              const day = minDate.getDay();
              if (day !== 0 && day !== 6) count++;
            }

            // Calculate maxValue working days
            count = 0;
            const maxDate = new Date(nowStart);
            while (count < maxValue) {
              maxDate.setDate(maxDate.getDate() + 1);
              const day = maxDate.getDay();
              if (day !== 0 && day !== 6) count++;
            }

            const expectedResult = dueDate >= minDate && dueDate <= maxDate;
            expect(result).toBe(expectedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 7: Filter composition uses AND logic
// **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
// ============================================================================

describe('Property 7: Filter composition uses AND logic', () => {
  it('Feature: automations-filters-dates, Property 7: Empty filters array matches all tasks - Validates: Requirements 3.1', () => {
    fc.assert(
      fc.property(arbTask, arbFilterContext, (task, ctx) => {
        const result = evaluateFilters([], task, ctx);
        // Empty filters array should match all tasks (vacuous truth)
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 7: Multiple filters use AND logic - Validates: Requirements 3.2, 3.3, 3.5', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.array(arbCardFilter, { minLength: 1, maxLength: 5 }),
        (task, ctx, filters) => {
          const result = evaluateFilters(filters, task, ctx);

          // Manually evaluate each filter and check that result matches AND of all
          const individualResults = filters.map((f) => evaluateFilter(f, task, ctx));
          const expectedResult = individualResults.every((r) => r === true);

          expect(result).toBe(expectedResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: automations-filters-dates, Property 7: Single false filter causes overall false - Validates: Requirements 3.5', () => {
    fc.assert(
      fc.property(
        arbTask,
        arbFilterContext,
        fc.array(arbCardFilter, { minLength: 2, maxLength: 5 }),
        (task, ctx, filters) => {
          const result = evaluateFilters(filters, task, ctx);

          // If any individual filter returns false, the overall result must be false
          const individualResults = filters.map((f) => evaluateFilter(f, task, ctx));
          const anyFalse = individualResults.some((r) => r === false);

          if (anyFalse) {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: scheduled-triggers-phase-5a, Property 18: is_complete / is_incomplete complementarity
describe('Property 18: is_complete / is_incomplete filter complementarity', () => {
  it('exactly one of is_complete / is_incomplete matches for any task', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (completed) => {
          const task = {
            id: 'task-1',
            projectId: 'proj-1',
            parentTaskId: null,
            sectionId: 'sec-1',
            description: 'Test',
            notes: '',
            assignee: '',
            priority: 'none' as const,
            tags: [],
            dueDate: null,
            completed,
            completedAt: completed ? new Date().toISOString() : null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const ctx = { now: new Date() };

          const isCompleteResult = filterPredicateMap.is_complete(task as any, { type: 'is_complete' } as any, ctx);
          const isIncompleteResult = filterPredicateMap.is_incomplete(task as any, { type: 'is_incomplete' } as any, ctx);

          // Mutually exclusive and exhaustive
          expect(isCompleteResult !== isIncompleteResult).toBe(true);
          // is_complete matches iff completed === true
          expect(isCompleteResult).toBe(completed);
          expect(isIncompleteResult).toBe(!completed);
        }
      ),
      { numRuns: 100 }
    );
  });
});
