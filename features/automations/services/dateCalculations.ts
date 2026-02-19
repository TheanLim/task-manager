import type { RelativeDateOption } from '../types';

/**
 * Calculate a date relative to a reference date based on the provided option.
 * All returned dates are normalized to the start of day (00:00:00.000).
 *
 * @param option - The relative date option (today, tomorrow, next_working_day, etc.)
 * @param from - The reference date (defaults to current date)
 * @param params - Optional parameters for specific date options
 * @param params.specificMonth - Month (1-12) for specific_date option
 * @param params.specificDay - Day (1-31) for specific_date option
 * @param params.monthTarget - Target month ('this_month' or 'next_month') for day-of-month and nth-weekday-of-month options
 * @returns A Date object set to the start of the calculated day
 *
 * @example
 * // Get today at start of day
 * calculateRelativeDate('today')
 *
 * @example
 * // Get next Monday
 * calculateRelativeDate('next_monday')
 *
 * @example
 * // Get the 15th of next month
 * calculateRelativeDate('day_of_month_15', undefined, { monthTarget: 'next_month' })
 *
 * @example
 * // Get a specific date (December 25th)
 * calculateRelativeDate('specific_date', undefined, { specificMonth: 12, specificDay: 25 })
 */
/**
 * Check if a date is a working day (Monday-Friday).
 *
 * @param date - The date to check
 * @returns true if the date is Monday-Friday, false if Saturday or Sunday
 *
 * @example
 * isWorkingDay(new Date('2024-01-08')) // Monday -> true
 * isWorkingDay(new Date('2024-01-13')) // Saturday -> false
 */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday=1 through Friday=5
}

/**
 * Calculate a date N working days from a reference date, skipping weekends.
 * When N=0, returns the reference date if it's a working day, otherwise the next working day.
 *
 * @param n - Number of working days to add (0 or positive integer)
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the calculated working day
 *
 * @example
 * // Get 5 working days from today
 * calculateWorkingDays(5)
 *
 * @example
 * // N=0 on a working day returns that day
 * calculateWorkingDays(0, new Date('2024-01-08')) // Monday -> Monday
 *
 * @example
 * // N=0 on a weekend returns next Monday
 * calculateWorkingDays(0, new Date('2024-01-13')) // Saturday -> Monday
 */
export function calculateWorkingDays(n: number, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0); // Normalize to start of day

  // Handle N=0 edge case
  if (n === 0) {
    if (isWorkingDay(result)) {
      return result;
    }
    // If weekend, advance to next Monday
    const day = result.getDay();
    if (day === 0) {
      // Sunday -> add 1 day
      result.setDate(result.getDate() + 1);
    } else if (day === 6) {
      // Saturday -> add 2 days
      result.setDate(result.getDate() + 2);
    }
    return result;
  }

  // Count working days
  let workingDaysAdded = 0;
  while (workingDaysAdded < n) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result)) {
      workingDaysAdded++;
    }
  }

  return result;
}

/**
 * Count the number of working days between two dates (exclusive of endpoints).
 *
 * @param from - The start date (exclusive)
 * @param to - The end date (exclusive)
 * @returns The count of working days strictly between the two dates
 *
 * @example
 * // Count working days in a week (Mon to Fri exclusive)
 * countWorkingDaysBetween(
 *   new Date('2024-01-08'), // Monday
 *   new Date('2024-01-12')  // Friday
 * ) // Returns 3 (Tue, Wed, Thu)
 *
 * @example
 * // Adjacent dates return 0
 * countWorkingDaysBetween(
 *   new Date('2024-01-08'),
 *   new Date('2024-01-09')
 * ) // Returns 0
 */
export function countWorkingDaysBetween(from: Date, to: Date): number {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // Start from day after 'from' (exclusive)

  while (current < end) {
    if (isWorkingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate the next occurrence of a specific weekday after the reference date.
 *
 * @param weekday - The target weekday (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the next occurrence of the weekday
 *
 * @example
 * // Get next Monday from a Wednesday
 * calculateNextWeekday(1, new Date('2024-01-10')) // Wed -> Mon (Jan 15)
 *
 * @example
 * // Get next Sunday from a Sunday (goes to next week)
 * calculateNextWeekday(0, new Date('2024-01-14')) // Sun -> Sun (Jan 21)
 */
export function calculateNextWeekday(weekday: number, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);

  const currentDay = result.getDay();
  let daysToAdd = weekday - currentDay;

  // If the target weekday is today or earlier in the week, go to next week
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }

  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Calculate a specific weekday in the following calendar week.
 *
 * @param weekday - The target weekday (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the specified weekday in the next calendar week
 *
 * @example
 * // Get Monday of next week from a Wednesday
 * calculateNextWeekOn(1, new Date('2024-01-10')) // Wed Jan 10 -> Mon Jan 15
 */
export function calculateNextWeekOn(weekday: number, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);

  // Find the Monday of the current week
  const currentDay = result.getDay();
  const daysToCurrentMonday = currentDay === 0 ? -6 : 1 - currentDay;
  result.setDate(result.getDate() + daysToCurrentMonday);

  // Move to next week's Monday
  result.setDate(result.getDate() + 7);

  // Now adjust to the target weekday within that week
  // Monday is day 1, so we need to adjust from Monday
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1; // Sunday is 6 days after Monday
  result.setDate(result.getDate() + daysFromMonday);

  return result;
}

/**
 * Calculate a specific day of the month, with optional month targeting.
 *
 * @param day - The target day (1-31, 'last', or 'last_working')
 * @param monthTarget - Whether to target 'this_month' or 'next_month' (defaults to 'this_month')
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the specified day
 *
 * @example
 * // Get the 15th of this month
 * calculateDayOfMonth(15, 'this_month')
 *
 * @example
 * // Get the last day of next month
 * calculateDayOfMonth('last', 'next_month')
 *
 * @example
 * // Get the last working day of this month
 * calculateDayOfMonth('last_working', 'this_month')
 */
export function calculateDayOfMonth(
  day: number | 'last' | 'last_working',
  monthTarget: 'this_month' | 'next_month' = 'this_month',
  from: Date = new Date()
): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);

  // Set to day 1 first to avoid rollover issues when changing months
  result.setDate(1);

  // Determine target month
  if (monthTarget === 'next_month') {
    result.setMonth(result.getMonth() + 1);
  }

  if (day === 'last') {
    // Get last day of the target month
    result.setMonth(result.getMonth() + 1, 0); // Day 0 of next month = last day of current month
    return result;
  }

  if (day === 'last_working') {
    // Get last day of the target month
    result.setMonth(result.getMonth() + 1, 0);
    // Walk backwards until we find a working day
    while (!isWorkingDay(result)) {
      result.setDate(result.getDate() - 1);
    }
    return result;
  }

  // Numeric day - clamp to valid range for the month
  const year = result.getFullYear();
  const month = result.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfMonth);

  result.setDate(clampedDay);
  return result;
}

/**
 * Calculate the nth occurrence of a specific weekday in a month.
 *
 * @param nth - The occurrence number (1-4 or 'last')
 * @param weekday - The target weekday (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param monthTarget - Whether to target 'this_month' or 'next_month' (defaults to 'this_month')
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the nth weekday
 *
 * @example
 * // Get the first Monday of this month
 * calculateNthWeekdayOfMonth(1, 1, 'this_month')
 *
 * @example
 * // Get the last Friday of next month
 * calculateNthWeekdayOfMonth('last', 5, 'next_month')
 */
export function calculateNthWeekdayOfMonth(
  nth: number | 'last',
  weekday: number,
  monthTarget: 'this_month' | 'next_month' = 'this_month',
  from: Date = new Date()
): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);

  // Determine target month - set to day 1 first to avoid rollover issues
  result.setDate(1);
  if (monthTarget === 'next_month') {
    result.setMonth(result.getMonth() + 1);
  }

  if (nth === 'last') {
    // Find all occurrences of the weekday in the month
    const occurrences: Date[] = [];
    const month = result.getMonth();

    while (result.getMonth() === month) {
      if (result.getDay() === weekday) {
        occurrences.push(new Date(result));
      }
      result.setDate(result.getDate() + 1);
    }

    // Return the last occurrence
    return occurrences[occurrences.length - 1];
  }

  // Find the nth occurrence
  let count = 0;
  const month = result.getMonth();

  while (result.getMonth() === month) {
    if (result.getDay() === weekday) {
      count++;
      if (count === nth) {
        return result;
      }
    }
    result.setDate(result.getDate() + 1);
  }

  // If we didn't find the nth occurrence, return the last occurrence
  // (e.g., asking for 5th Monday when there are only 4)
  result.setDate(1);
  const occurrences: Date[] = [];
  while (result.getMonth() === month) {
    if (result.getDay() === weekday) {
      occurrences.push(new Date(result));
    }
    result.setDate(result.getDate() + 1);
  }
  return occurrences[occurrences.length - 1];
}

/**
 * Calculate a specific date (month and day) in the current or next year.
 *
 * @param month - The target month (1-12)
 * @param day - The target day (1-31)
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the specified date
 *
 * @example
 * // Get December 25th (this year or next if already passed)
 * calculateSpecificDate(12, 25)
 *
 * @example
 * // Get February 29th (handles non-leap years by returning Feb 28)
 * calculateSpecificDate(2, 29)
 */
export function calculateSpecificDate(
  month: number,
  day: number,
  from: Date = new Date()
): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);

  const currentYear = result.getFullYear();
  const currentMonth = result.getMonth() + 1; // getMonth() is 0-indexed
  const currentDay = result.getDate();

  // Helper to check leap year
  const isLeapYear = (year: number) =>
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  // Helper to set date with proper handling
  const setDateForYear = (year: number) => {
    result.setFullYear(year);
    // Set day to 1 first to avoid month overflow issues
    result.setDate(1);
    result.setMonth(month - 1); // setMonth is 0-indexed

    // Handle Feb 29 in non-leap years
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      result.setDate(28);
    } else {
      // Clamp day to valid range for the month
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      result.setDate(Math.min(day, lastDayOfMonth));
    }
  };

  // Try current year first
  setDateForYear(currentYear);

  // If the date has already passed this year, move to next year
  if (
    month < currentMonth ||
    (month === currentMonth && day < currentDay)
  ) {
    setDateForYear(currentYear + 1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Data-driven lookup tables for calculateRelativeDate
// ---------------------------------------------------------------------------

/** Weekday name → JS weekday number (0=Sun, 1=Mon, ..., 6=Sat) */
const WEEKDAY_MAP: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

/** Ordinal name → nth value for calculateNthWeekdayOfMonth */
const ORDINAL_MAP: Record<string, number | 'last'> = {
  first: 1, second: 2, third: 3, fourth: 4, last: 'last',
};

/**
 * Try to parse a `day_of_month_N` option string.
 * Returns the day number (1-31) or null if no match.
 */
function parseDayOfMonth(option: string): number | null {
  const match = option.match(/^day_of_month_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Try to parse a `next_<weekday>` option string.
 * Returns the JS weekday number or null if no match.
 */
function parseNextWeekday(option: string): number | null {
  const match = option.match(/^next_(\w+)$/);
  if (!match) return null;
  const weekday = WEEKDAY_MAP[match[1]];
  return weekday !== undefined ? weekday : null;
}

/**
 * Try to parse a `next_week_<weekday>` option string.
 * Returns the JS weekday number or null if no match.
 */
function parseNextWeekOn(option: string): number | null {
  const match = option.match(/^next_week_(\w+)$/);
  if (!match) return null;
  const weekday = WEEKDAY_MAP[match[1]];
  return weekday !== undefined ? weekday : null;
}

/**
 * Try to parse a `<ordinal>_<weekday>_of_month` option string.
 * Returns [nth, weekday] or null if no match.
 */
function parseNthWeekdayOfMonth(option: string): [number | 'last', number] | null {
  const match = option.match(/^(\w+?)_(\w+?)_of_month$/);
  if (!match) return null;
  const nth = ORDINAL_MAP[match[1]];
  const weekday = WEEKDAY_MAP[match[2]];
  if (nth === undefined || weekday === undefined) return null;
  return [nth, weekday];
}

export function calculateRelativeDate(
  option: RelativeDateOption,
  from: Date = new Date(),
  params?: {
    specificMonth?: number;
    specificDay?: number;
    monthTarget?: 'this_month' | 'next_month';
  }
): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0); // Normalize to start of day

  // Simple named options
  if (option === 'today') return result;
  if (option === 'tomorrow') { result.setDate(result.getDate() + 1); return result; }
  if (option === 'next_working_day') return calculateWorkingDays(1, from);

  // Special month options
  if (option === 'last_day_of_month') return calculateDayOfMonth('last', params?.monthTarget, from);
  if (option === 'last_working_day_of_month') return calculateDayOfMonth('last_working', params?.monthTarget, from);

  // Specific date
  if (option === 'specific_date') {
    if (!params?.specificMonth || !params?.specificDay) {
      throw new Error('specific_date option requires specificMonth and specificDay parameters');
    }
    return calculateSpecificDate(params.specificMonth, params.specificDay, from);
  }

  // Data-driven: day_of_month_N
  const dayOfMonth = parseDayOfMonth(option);
  if (dayOfMonth !== null) return calculateDayOfMonth(dayOfMonth, params?.monthTarget, from);

  // Data-driven: next_week_<weekday> (must check before next_<weekday>)
  const nextWeekOn = parseNextWeekOn(option);
  if (nextWeekOn !== null) return calculateNextWeekOn(nextWeekOn, from);

  // Data-driven: next_<weekday>
  const nextWeekday = parseNextWeekday(option);
  if (nextWeekday !== null) return calculateNextWeekday(nextWeekday, from);

  // Data-driven: <ordinal>_<weekday>_of_month
  const nthWeekday = parseNthWeekdayOfMonth(option);
  if (nthWeekday !== null) return calculateNthWeekdayOfMonth(nthWeekday[0], nthWeekday[1], params?.monthTarget, from);

  // Exhaustive check — should never reach here with valid RelativeDateOption
  throw new Error(`Unhandled date option: ${option}`);
}
