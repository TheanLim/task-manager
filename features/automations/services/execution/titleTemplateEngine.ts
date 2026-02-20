import type { Clock } from '../scheduler/clock';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Replaces {{date}}, {{day}}, {{weekday}}, {{month}} placeholders in a template string.
 * {{day}} is an alias for {{date}} (both resolve to YYYY-MM-DD).
 * Unrecognized {{...}} placeholders are left as-is.
 * Pure function — no side effects.
 */
export function interpolateTitle(template: string, clock: Clock): string {
  const date = clock.toDate();
  const dateStr = date.toISOString().slice(0, 10);
  return template
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{day\}\}/g, dateStr)
    .replace(/\{\{weekday\}\}/g, WEEKDAYS[date.getDay()])
    .replace(/\{\{month\}\}/g, MONTHS[date.getMonth()]);
}
