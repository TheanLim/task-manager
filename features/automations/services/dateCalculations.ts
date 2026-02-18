import type { RelativeDateOption } from '../types';

/**
 * Calculate a date relative to a reference date based on the provided option.
 * All returned dates are normalized to the start of day (00:00:00.000).
 *
 * @param option - The relative date option (today, tomorrow, next_working_day)
 * @param from - The reference date (defaults to current date)
 * @returns A Date object set to the start of the calculated day
 *
 * @example
 * // Get today at start of day
 * calculateRelativeDate('today')
 *
 * @example
 * // Get tomorrow at start of day
 * calculateRelativeDate('tomorrow')
 *
 * @example
 * // Get next working day (skips weekends)
 * calculateRelativeDate('next_working_day')
 *
 * @example
 * // Calculate relative to a specific date
 * calculateRelativeDate('next_working_day', new Date('2024-01-05')) // Friday -> Monday
 */
export function calculateRelativeDate(
  option: RelativeDateOption,
  from: Date = new Date()
): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0); // Normalize to start of day

  switch (option) {
    case 'today':
      return result;

    case 'tomorrow':
      result.setDate(result.getDate() + 1);
      return result;

    case 'next_working_day': {
      const day = result.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

      if (day === 5) {
        // Friday -> add 3 days to get to Monday
        result.setDate(result.getDate() + 3);
      } else if (day === 6) {
        // Saturday -> add 2 days to get to Monday
        result.setDate(result.getDate() + 2);
      } else if (day === 0) {
        // Sunday -> add 1 day to get to Monday
        result.setDate(result.getDate() + 1);
      } else {
        // Monday-Thursday -> add 1 day to get next day
        result.setDate(result.getDate() + 1);
      }

      return result;
    }
  }
}
