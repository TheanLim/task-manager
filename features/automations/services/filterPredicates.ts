import type { Task } from '@/lib/schemas';
import type { CardFilter } from '../schemas';
import { calculateWorkingDays, countWorkingDaysBetween } from './dateCalculations';

/**
 * Read-only snapshot of current date/time and application state provided to filter predicate functions.
 * Allows for deterministic testing by injecting a fixed reference date.
 */
export interface FilterContext {
  /** Current date-time for date-based filter evaluation */
  now: Date;
}

/**
 * A predicate function that evaluates whether a task matches a specific filter condition.
 *
 * @param task - The task to evaluate
 * @param filter - The filter configuration
 * @param ctx - The evaluation context containing current date/time
 * @returns true if the task matches the filter condition, false otherwise
 */
export type FilterPredicate = (
  task: Task,
  filter: CardFilter,
  ctx: FilterContext
) => boolean;

/**
 * Helper: Check if a date falls within the same calendar day as the reference date.
 */
function isSameDay(date: Date, reference: Date): boolean {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/**
 * Helper: Check if a date falls within the same calendar week (Monday-Sunday) as the reference date.
 */
function isSameWeek(date: Date, reference: Date): boolean {
  // Get Monday of the week for both dates
  const getMonday = (d: Date): Date => {
    const result = new Date(d);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Sunday is 0, Monday is 1
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const mondayOfDate = getMonday(date);
  const mondayOfReference = getMonday(reference);

  return mondayOfDate.getTime() === mondayOfReference.getTime();
}

/**
 * Helper: Check if a date falls within the same calendar month as the reference date.
 */
function isSameMonth(date: Date, reference: Date): boolean {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
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
 * Helper: Get the Monday of the next calendar week.
 */
function getNextWeekMonday(reference: Date): Date {
  const result = new Date(reference);
  const day = result.getDay();
  const daysToNextMonday = day === 0 ? 1 : 8 - day; // If Sunday, add 1; otherwise 8 - current day
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
  result.setDate(result.getDate() + 6); // Sunday is 6 days after Monday
  result.setHours(23, 59, 59, 999);
  return result;
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
  result.setMonth(result.getMonth() + 2, 0); // Day 0 of month+2 = last day of month+1
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Registry of filter predicate functions keyed by filter type.
 * Each predicate evaluates a specific filter condition against a task.
 */
export const filterPredicateMap: Record<string, FilterPredicate> = {
  // Section filters
  in_section: (task, filter) => {
    if (filter.type !== 'in_section') return false;
    return task.sectionId === filter.sectionId;
  },

  not_in_section: (task, filter) => {
    if (filter.type !== 'not_in_section') return false;
    return task.sectionId !== filter.sectionId;
  },

  // Due date presence filters
  has_due_date: (task) => {
    return task.dueDate !== null;
  },

  no_due_date: (task) => {
    return task.dueDate === null;
  },

  // Overdue filter
  is_overdue: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    if (task.completed) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate < ctx.now;
  },

  // Positive date range filters
  due_today: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    const dueDate = new Date(task.dueDate);
    return isSameDay(dueDate, ctx.now);
  },

  due_tomorrow: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    const dueDate = new Date(task.dueDate);
    const tomorrow = getNextDay(ctx.now);
    return isSameDay(dueDate, tomorrow);
  },

  due_this_week: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    const dueDate = new Date(task.dueDate);
    return isSameWeek(dueDate, ctx.now);
  },

  due_next_week: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    const dueDate = new Date(task.dueDate);
    const nextWeekMonday = getNextWeekMonday(ctx.now);
    const nextWeekSunday = getNextWeekSunday(ctx.now);
    return dueDate >= nextWeekMonday && dueDate <= nextWeekSunday;
  },

  due_this_month: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    const dueDate = new Date(task.dueDate);
    return isSameMonth(dueDate, ctx.now);
  },

  due_next_month: (task, _filter, ctx) => {
    if (task.dueDate === null) return false;
    const dueDate = new Date(task.dueDate);
    const nextMonthStart = getNextMonthStart(ctx.now);
    const nextMonthEnd = getNextMonthEnd(ctx.now);
    return dueDate >= nextMonthStart && dueDate <= nextMonthEnd;
  },

  // Comparison date filters
  due_in_less_than: (task, filter, ctx) => {
    if (filter.type !== 'due_in_less_than') return false;
    if (task.dueDate === null) return false;

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0); // Normalize to start of day

    if (filter.unit === 'days') {
      // Calculate N days from now
      const targetDate = new Date(ctx.now);
      targetDate.setHours(0, 0, 0, 0);
      targetDate.setDate(targetDate.getDate() + filter.value);

      // Due date must be after now and before or on the target date
      const nowStart = new Date(ctx.now);
      nowStart.setHours(0, 0, 0, 0);
      return dueDate > nowStart && dueDate <= targetDate;
    } else {
      // working_days
      const targetDate = calculateWorkingDays(filter.value, ctx.now);
      const nowStart = new Date(ctx.now);
      nowStart.setHours(0, 0, 0, 0);
      return dueDate > nowStart && dueDate <= targetDate;
    }
  },

  due_in_more_than: (task, filter, ctx) => {
    if (filter.type !== 'due_in_more_than') return false;
    if (task.dueDate === null) return false;

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (filter.unit === 'days') {
      const targetDate = new Date(ctx.now);
      targetDate.setHours(0, 0, 0, 0);
      targetDate.setDate(targetDate.getDate() + filter.value);

      // Due date must be after the target date
      return dueDate > targetDate;
    } else {
      // working_days
      const targetDate = calculateWorkingDays(filter.value, ctx.now);
      return dueDate > targetDate;
    }
  },

  due_in_exactly: (task, filter, ctx) => {
    if (filter.type !== 'due_in_exactly') return false;
    if (task.dueDate === null) return false;

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (filter.unit === 'days') {
      const targetDate = new Date(ctx.now);
      targetDate.setHours(0, 0, 0, 0);
      targetDate.setDate(targetDate.getDate() + filter.value);

      return dueDate.getTime() === targetDate.getTime();
    } else {
      // working_days
      const targetDate = calculateWorkingDays(filter.value, ctx.now);
      return dueDate.getTime() === targetDate.getTime();
    }
  },

  due_in_between: (task, filter, ctx) => {
    if (filter.type !== 'due_in_between') return false;
    if (task.dueDate === null) return false;

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (filter.unit === 'days') {
      const minDate = new Date(ctx.now);
      minDate.setHours(0, 0, 0, 0);
      minDate.setDate(minDate.getDate() + filter.minValue);

      const maxDate = new Date(ctx.now);
      maxDate.setHours(0, 0, 0, 0);
      maxDate.setDate(maxDate.getDate() + filter.maxValue);

      return dueDate >= minDate && dueDate <= maxDate;
    } else {
      // working_days
      const minDate = calculateWorkingDays(filter.minValue, ctx.now);
      const maxDate = calculateWorkingDays(filter.maxValue, ctx.now);
      return dueDate >= minDate && dueDate <= maxDate;
    }
  },
};

// Negated date filters - logical negation of positive counterparts
// Also return true when dueDate is null
filterPredicateMap.not_due_today = (task, filter, ctx) => {
  if (task.dueDate === null) return true;
  return !filterPredicateMap.due_today(task, filter, ctx);
};

filterPredicateMap.not_due_tomorrow = (task, filter, ctx) => {
  if (task.dueDate === null) return true;
  return !filterPredicateMap.due_tomorrow(task, filter, ctx);
};

filterPredicateMap.not_due_this_week = (task, filter, ctx) => {
  if (task.dueDate === null) return true;
  return !filterPredicateMap.due_this_week(task, filter, ctx);
};

filterPredicateMap.not_due_next_week = (task, filter, ctx) => {
  if (task.dueDate === null) return true;
  return !filterPredicateMap.due_next_week(task, filter, ctx);
};

filterPredicateMap.not_due_this_month = (task, filter, ctx) => {
  if (task.dueDate === null) return true;
  return !filterPredicateMap.due_this_month(task, filter, ctx);
};

filterPredicateMap.not_due_next_month = (task, filter, ctx) => {
  if (task.dueDate === null) return true;
  return !filterPredicateMap.due_next_month(task, filter, ctx);
};

/**
 * Evaluate a single filter against a task.
 *
 * @param filter - The filter configuration to evaluate
 * @param task - The task to evaluate against
 * @param ctx - The evaluation context containing current date/time
 * @returns true if the task matches the filter condition, false otherwise
 */
export function evaluateFilter(
  filter: CardFilter,
  task: Task,
  ctx: FilterContext
): boolean {
  const predicate = filterPredicateMap[filter.type];
  if (!predicate) {
    throw new Error(`Unknown filter type: ${filter.type}`);
  }
  return predicate(task, filter, ctx);
}

/**
 * Evaluate multiple filters against a task using AND logic.
 * All filters must return true for the task to match.
 *
 * @param filters - Array of filter configurations to evaluate
 * @param task - The task to evaluate against
 * @param ctx - The evaluation context containing current date/time
 * @returns true if the task matches all filters, false if any filter fails
 */
export function evaluateFilters(
  filters: CardFilter[],
  task: Task,
  ctx: FilterContext
): boolean {
  return filters.every((f) => evaluateFilter(f, task, ctx));
}
