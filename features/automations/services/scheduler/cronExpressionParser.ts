/**
 * Cron expression parser — pure functions for converting between
 * 5-field cron strings and structured CronSchedule objects.
 *
 * Supports: numeric values, comma lists, ranges, wildcards, steps.
 * Rejects: 6+ fields, L, W, #, ?, non-* month.
 *
 * Storage is always structured fields — cron strings are an input convenience.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface CronParseSchedule {
  hour: number;
  minute: number;
  daysOfWeek: number[];
  daysOfMonth: number[];
}

export type CronParseResult =
  | { success: true; schedule: CronParseSchedule }
  | { success: false; error: string };

// ─── Unsupported character detection ────────────────────────────────────

const UNSUPPORTED_CHARS = /[LWlw#?]/;

// ─── Field parsing helpers ──────────────────────────────────────────────

/**
 * Parse a single cron field into an array of numeric values.
 * Supports: *, N, N-M, N,M,O, * /S, N-M/S
 * Returns null on invalid input.
 */
function parseField(
  field: string,
  min: number,
  max: number,
  fieldName: string
): { values: number[] | null; error?: string } {
  if (UNSUPPORTED_CHARS.test(field)) {
    return { values: null, error: `Unsupported character in ${fieldName} field: "${field}"` };
  }

  // Wildcard
  if (field === '*') {
    return { values: null }; // null means "all" / wildcard
  }

  // Step: */N or N-M/N
  if (field.includes('/')) {
    const [rangePart, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step < 1) {
      return { values: null, error: `Invalid step value "${stepStr}" in ${fieldName} field` };
    }

    let start = min;
    let end = max;

    if (rangePart !== '*') {
      if (rangePart.includes('-')) {
        const [s, e] = rangePart.split('-').map(Number);
        if (isNaN(s) || isNaN(e) || s < min || e > max || s > e) {
          return { values: null, error: `Invalid range "${rangePart}" in ${fieldName} field` };
        }
        start = s;
        end = e;
      } else {
        const n = parseInt(rangePart, 10);
        if (isNaN(n) || n < min || n > max) {
          return { values: null, error: `Invalid value "${rangePart}" in ${fieldName} field` };
        }
        start = n;
      }
    }

    const values: number[] = [];
    for (let i = start; i <= end; i += step) {
      values.push(i);
    }
    return { values };
  }

  // Range: N-M
  if (field.includes('-')) {
    const parts = field.split('-');
    if (parts.length !== 2) {
      return { values: null, error: `Invalid range "${field}" in ${fieldName} field` };
    }
    const [s, e] = parts.map(Number);
    if (isNaN(s) || isNaN(e) || s < min || e > max || s > e) {
      return { values: null, error: `Invalid range "${field}" in ${fieldName} field` };
    }
    const values: number[] = [];
    for (let i = s; i <= e; i++) values.push(i);
    return { values };
  }

  // Comma list: N,M,O
  if (field.includes(',')) {
    const parts = field.split(',');
    const values: number[] = [];
    for (const p of parts) {
      const n = parseInt(p.trim(), 10);
      if (isNaN(n) || n < min || n > max) {
        return { values: null, error: `Invalid value "${p}" in ${fieldName} field` };
      }
      values.push(n);
    }
    return { values: values.sort((a, b) => a - b) };
  }

  // Single numeric value
  const n = parseInt(field, 10);
  if (isNaN(n) || n < min || n > max) {
    return { values: null, error: `Invalid value "${field}" in ${fieldName} field (expected ${min}-${max})` };
  }
  return { values: [n] };
}

// ─── parseCronExpression ────────────────────────────────────────────────

/**
 * Parse a 5-field cron expression into structured CronSchedule fields.
 *
 * Format: minute hour day-of-month month day-of-week
 * Month must be *.
 * Rejects step values for minute/hour that produce multiple values
 * (since CronSchedule has single hour/minute fields).
 */
export function parseCronExpression(expr: string): CronParseResult {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { success: false, error: 'Cron expression is required' };
  }

  // Check for unsupported characters before splitting
  if (UNSUPPORTED_CHARS.test(trimmed)) {
    const match = trimmed.match(UNSUPPORTED_CHARS);
    return { success: false, error: `Unsupported character "${match?.[0]}" in cron expression` };
  }

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    return {
      success: false,
      error: fields.length > 5
        ? `Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}. 6-field (seconds) and 7-field (year) cron expressions are not supported.`
        : `Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`,
    };
  }

  const [minuteField, hourField, domField, monthField, dowField] = fields;

  // Month must be *
  if (monthField !== '*') {
    return { success: false, error: 'Month filtering is not supported. Use * for the month field.' };
  }

  // Parse minute — must resolve to a single value
  const minuteResult = parseField(minuteField, 0, 59, 'minute');
  if (minuteResult.error) return { success: false, error: minuteResult.error };
  if (minuteResult.values === null) {
    // Wildcard for minute means "every minute" — can't represent as single value
    return { success: false, error: 'Wildcard (*) for minute field produces multiple values and cannot be represented as a single schedule' };
  }
  if (minuteResult.values.length !== 1) {
    return { success: false, error: `The minute field "${minuteField}" produces multiple values and cannot be represented as a single schedule` };
  }
  const minute = minuteResult.values[0];

  // Parse hour — must resolve to a single value
  const hourResult = parseField(hourField, 0, 23, 'hour');
  if (hourResult.error) return { success: false, error: hourResult.error };
  if (hourResult.values === null) {
    return { success: false, error: 'Wildcard (*) for hour field produces multiple values and cannot be represented as a single schedule' };
  }
  if (hourResult.values.length !== 1) {
    return { success: false, error: `The hour field "${hourField}" produces multiple values and cannot be represented as a single schedule` };
  }
  const hour = hourResult.values[0];

  // Parse day-of-month
  const domResult = parseField(domField, 1, 31, 'day-of-month');
  if (domResult.error) return { success: false, error: domResult.error };
  const daysOfMonth = domResult.values ?? [];

  // Parse day-of-week
  const dowResult = parseField(dowField, 0, 6, 'day-of-week');
  if (dowResult.error) return { success: false, error: dowResult.error };
  const daysOfWeek = dowResult.values ?? [];

  return {
    success: true,
    schedule: { hour, minute, daysOfWeek, daysOfMonth },
  };
}

// ─── toCronExpression ───────────────────────────────────────────────────

/**
 * Convert structured CronSchedule fields to a 5-field cron string.
 * Empty daysOfWeek and daysOfMonth produce * for those fields.
 * Month field is always *.
 */
export function toCronExpression(schedule: CronParseSchedule): string {
  const minute = String(schedule.minute);
  const hour = String(schedule.hour);
  const dom = schedule.daysOfMonth.length > 0
    ? schedule.daysOfMonth.join(',')
    : '*';
  const month = '*';
  const dow = schedule.daysOfWeek.length > 0
    ? schedule.daysOfWeek.join(',')
    : '*';

  return `${minute} ${hour} ${dom} ${month} ${dow}`;
}

// ─── cronExpressionDescription ──────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Generate a human-readable description from structured CronSchedule fields.
 * Reuses the same day-name and ordinal patterns as rulePreviewService.describeSchedule.
 */
export function cronExpressionDescription(schedule: CronParseSchedule): string {
  const time = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;

  if (schedule.daysOfWeek.length > 0) {
    if (schedule.daysOfWeek.length === 1) {
      return `Every ${DAY_NAMES[schedule.daysOfWeek[0]]} at ${time}`;
    }
    const days = schedule.daysOfWeek.map(d => DAY_NAMES_SHORT[d]).join(', ');
    return `Every ${days} at ${time}`;
  }

  if (schedule.daysOfMonth.length > 0) {
    const days = schedule.daysOfMonth.map(ordinal).join(', ');
    return `Every ${days} of month at ${time}`;
  }

  return `Every day at ${time}`;
}
