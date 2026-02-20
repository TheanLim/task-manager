/**
 * Tests for scheduleDescriptions.ts.
 * Core logic is also tested via rulePreviewService.test.ts (backward-compat re-exports).
 * These tests verify the canonical import path works correctly.
 */
import { describe, it, expect } from 'vitest';
import { describeSchedule, computeNextRunDescription, formatShortDate, formatFireAt } from './scheduleDescriptions';

describe('describeSchedule (canonical import)', () => {
  it('describes interval in minutes', () => {
    expect(describeSchedule({ type: 'scheduled_interval', schedule: { intervalMinutes: 30 } }))
      .toBe('30 minutes');
  });

  it('describes interval in hours', () => {
    expect(describeSchedule({ type: 'scheduled_interval', schedule: { intervalMinutes: 120 } }))
      .toBe('2 hours');
  });

  it('describes interval in days', () => {
    expect(describeSchedule({ type: 'scheduled_interval', schedule: { intervalMinutes: 2880 } }))
      .toBe('2 days');
  });

  it('describes cron with days of week', () => {
    expect(describeSchedule({
      type: 'scheduled_cron',
      schedule: { hour: 9, minute: 0, daysOfWeek: [1, 3, 5], daysOfMonth: [] },
    })).toBe('Mon, Wed, Fri at 09:00');
  });

  it('describes due-date-relative before', () => {
    expect(describeSchedule({
      type: 'scheduled_due_date_relative',
      schedule: { offsetMinutes: -1440, displayUnit: 'days' },
    })).toBe('1 day before due date');
  });

  it('describes one-time', () => {
    const result = describeSchedule({
      type: 'scheduled_one_time',
      schedule: { fireAt: '2026-03-15T14:30:00.000Z' },
    });
    expect(result).toContain('Mar 15, 2026');
  });

  it('returns Unknown for missing schedule', () => {
    expect(describeSchedule({ type: 'scheduled_interval' })).toBe('Unknown');
  });
});

describe('computeNextRunDescription (canonical import)', () => {
  it('returns "On next tick" for interval without lastEvaluatedAt', () => {
    expect(computeNextRunDescription(
      { type: 'scheduled_interval', schedule: { intervalMinutes: 60 } },
      Date.now()
    )).toBe('On next tick');
  });

  it('returns "Checks on next tick" for due-date-relative', () => {
    expect(computeNextRunDescription(
      { type: 'scheduled_due_date_relative', schedule: { offsetMinutes: -1440 } },
      Date.now()
    )).toBe('Checks on next tick');
  });
});

describe('formatShortDate', () => {
  it('formats a date as "Mon DD, YYYY"', () => {
    expect(formatShortDate(new Date('2026-03-15T00:00:00.000Z'))).toBe('Mar 15, 2026');
  });
});

describe('formatFireAt', () => {
  it('formats an ISO datetime as "Mon DD, YYYY at HH:MM"', () => {
    expect(formatFireAt('2026-03-15T14:30:00.000Z')).toBe('Mar 15, 2026 at 14:30');
  });
});
