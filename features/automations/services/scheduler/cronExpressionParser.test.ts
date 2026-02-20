import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseCronExpression,
  toCronExpression,
  cronExpressionDescription,
} from './cronExpressionParser';

// ─── Generators ─────────────────────────────────────────────────────────

/** Valid CronSchedule generator (for round-trip testing) */
const cronScheduleArb = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  daysOfWeek: fc.oneof(
    fc.constant([] as number[]),
    fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 })
      .map(arr => arr.sort((a, b) => a - b))
  ),
  daysOfMonth: fc.constant([] as number[]), // mutually exclusive with daysOfWeek
});

/** CronSchedule with daysOfMonth instead of daysOfWeek */
const cronScheduleMonthlyArb = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  daysOfWeek: fc.constant([] as number[]),
  daysOfMonth: fc.uniqueArray(fc.integer({ min: 1, max: 31 }), { minLength: 1, maxLength: 5 })
    .map(arr => arr.sort((a, b) => a - b)),
});

/** Generates unsupported cron special characters */
const unsupportedCharArb = fc.constantFrom('L', 'W', '#', '?');

// ─── Property Tests ─────────────────────────────────────────────────────

describe('cronExpressionParser property tests', () => {
  // Feature: scheduled-triggers-phase-5c, Property 4: Cron expression round-trip
  // **Validates: Requirements 3.1, 3.5**
  it('P4: round-trip — parseCronExpression(toCronExpression(schedule)) produces equivalent schedule (weekly)', () => {
    fc.assert(
      fc.property(cronScheduleArb, (schedule) => {
        const cronStr = toCronExpression(schedule);
        const result = parseCronExpression(cronStr);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.schedule.hour).toBe(schedule.hour);
          expect(result.schedule.minute).toBe(schedule.minute);
          expect(result.schedule.daysOfWeek).toEqual(schedule.daysOfWeek);
          expect(result.schedule.daysOfMonth).toEqual(schedule.daysOfMonth);
        }
      }),
      { numRuns: 150 }
    );
  });

  it('P4: round-trip — parseCronExpression(toCronExpression(schedule)) produces equivalent schedule (monthly)', () => {
    fc.assert(
      fc.property(cronScheduleMonthlyArb, (schedule) => {
        const cronStr = toCronExpression(schedule);
        const result = parseCronExpression(cronStr);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.schedule.hour).toBe(schedule.hour);
          expect(result.schedule.minute).toBe(schedule.minute);
          expect(result.schedule.daysOfWeek).toEqual(schedule.daysOfWeek);
          expect(result.schedule.daysOfMonth).toEqual(schedule.daysOfMonth);
        }
      }),
      { numRuns: 150 }
    );
  });

  // Feature: scheduled-triggers-phase-5c, Property 5: Cron expression validation rejects unsupported features
  // **Validates: Requirements 3.3, 3.6**
  it('P5: rejects 6+ field cron expressions (seconds not supported)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 23 }),
        fc.constantFrom('*', '1', '1-5'),
        fc.constantFrom('*'),
        fc.constantFrom('*', '0', '1-5'),
        (sec, min, hour, dom, month, dow) => {
          const expr = `${sec} ${min} ${hour} ${dom} ${month} ${dow}`;
          const result = parseCronExpression(expr);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P5: rejects unsupported special characters (L, W, #, ?)', () => {
    fc.assert(
      fc.property(
        unsupportedCharArb,
        fc.constantFrom('minute', 'hour', 'dom', 'dow') as fc.Arbitrary<string>,
        (char, field) => {
          let expr: string;
          switch (field) {
            case 'minute': expr = `${char} 9 * * *`; break;
            case 'hour': expr = `0 ${char} * * *`; break;
            case 'dom': expr = `0 9 ${char} * *`; break;
            case 'dow': expr = `0 9 * * ${char}`; break;
            default: expr = `0 9 * * ${char}`;
          }
          const result = parseCronExpression(expr);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P5: rejects non-* month field', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        (month) => {
          const expr = `0 9 * ${month} *`;
          const result = parseCronExpression(expr);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: scheduled-triggers-phase-5c, Property 6: Cron expression determinism
  // **Validates: Requirement 3.1**
  it('P6: determinism — same input always produces same output', () => {
    fc.assert(
      fc.property(cronScheduleArb, (schedule) => {
        const cronStr = toCronExpression(schedule);
        const r1 = parseCronExpression(cronStr);
        const r2 = parseCronExpression(cronStr);
        expect(r1).toEqual(r2);
      }),
      { numRuns: 150 }
    );
  });

  // Feature: scheduled-triggers-phase-5c, Property 12: parseCronExpression handles all standard cron features
  // **Validates: Requirements 3.1, 3.2**
  it('P12: handles numeric values correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 23 }),
        (minute, hour) => {
          const result = parseCronExpression(`${minute} ${hour} * * *`);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.schedule.minute).toBe(minute);
            expect(result.schedule.hour).toBe(hour);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P12: handles comma lists for day-of-week', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 2, maxLength: 7 })
          .map(arr => arr.sort((a, b) => a - b)),
        (days) => {
          const expr = `0 9 * * ${days.join(',')}`;
          const result = parseCronExpression(expr);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.schedule.daysOfWeek).toEqual(days);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P12: handles ranges for day-of-week', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 1, max: 6 }),
        (start, end) => {
          fc.pre(start < end); // only valid ranges
          const expr = `0 9 * * ${start}-${end}`;
          const result = parseCronExpression(expr);
          expect(result.success).toBe(true);
          if (result.success) {
            const expected = [];
            for (let i = start; i <= end; i++) expected.push(i);
            expect(result.schedule.daysOfWeek).toEqual(expected);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P12: handles wildcards correctly', () => {
    const result = parseCronExpression('0 9 * * *');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule.daysOfWeek).toEqual([]);
      expect(result.schedule.daysOfMonth).toEqual([]);
    }
  });
});

// ─── Example Tests ──────────────────────────────────────────────────────

describe('parseCronExpression example tests', () => {
  it('parses "0 9 * * 1" → Monday at 09:00', () => {
    const result = parseCronExpression('0 9 * * 1');
    expect(result).toEqual({
      success: true,
      schedule: { minute: 0, hour: 9, daysOfWeek: [1], daysOfMonth: [] },
    });
  });

  it('parses "30 8 * * 1-5" → weekdays at 08:30', () => {
    const result = parseCronExpression('30 8 * * 1-5');
    expect(result).toEqual({
      success: true,
      schedule: { minute: 30, hour: 8, daysOfWeek: [1, 2, 3, 4, 5], daysOfMonth: [] },
    });
  });

  it('parses "0 9 1 * *" → 1st of month at 09:00', () => {
    const result = parseCronExpression('0 9 1 * *');
    expect(result).toEqual({
      success: true,
      schedule: { minute: 0, hour: 9, daysOfWeek: [], daysOfMonth: [1] },
    });
  });

  it('rejects "*/15 * * * *" — minute step produces multiple values', () => {
    const result = parseCronExpression('*/15 * * * *');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('minute');
    }
  });

  it('rejects "0 9 * 3 *" — month filtering not supported', () => {
    const result = parseCronExpression('0 9 * 3 *');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('month');
    }
  });

  it('rejects "0 0 9 * * 1" — 6 fields (seconds not supported)', () => {
    const result = parseCronExpression('0 0 9 * * 1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('5 fields');
    }
  });

  it('rejects empty string', () => {
    const result = parseCronExpression('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('required');
    }
  });

  it('rejects expressions with L character', () => {
    const result = parseCronExpression('0 9 L * *');
    expect(result.success).toBe(false);
  });

  it('rejects expressions with W character', () => {
    const result = parseCronExpression('0 9 15W * *');
    expect(result.success).toBe(false);
  });

  it('rejects expressions with # character', () => {
    const result = parseCronExpression('0 9 * * 1#2');
    expect(result.success).toBe(false);
  });

  it('rejects expressions with ? character', () => {
    const result = parseCronExpression('0 9 ? * 1');
    expect(result.success).toBe(false);
  });

  it('parses comma-separated day-of-month values', () => {
    const result = parseCronExpression('0 9 1,15 * *');
    expect(result).toEqual({
      success: true,
      schedule: { minute: 0, hour: 9, daysOfWeek: [], daysOfMonth: [1, 15] },
    });
  });

  it('parses step values for day-of-week (*/2)', () => {
    const result = parseCronExpression('0 9 * * */2');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule.daysOfWeek).toEqual([0, 2, 4, 6]);
    }
  });

  it('parses range with step for day-of-week (1-5/2)', () => {
    const result = parseCronExpression('0 9 * * 1-5/2');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule.daysOfWeek).toEqual([1, 3, 5]);
    }
  });
});

describe('toCronExpression example tests', () => {
  it('converts Monday at 09:00', () => {
    expect(toCronExpression({ hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }))
      .toBe('0 9 * * 1');
  });

  it('converts every day at 09:00', () => {
    expect(toCronExpression({ hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }))
      .toBe('0 9 * * *');
  });

  it('converts 1st and 15th of month at 09:00', () => {
    expect(toCronExpression({ hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1, 15] }))
      .toBe('0 9 1,15 * *');
  });
});

describe('cronExpressionDescription example tests', () => {
  it('describes Monday at 09:00', () => {
    expect(cronExpressionDescription({ hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }))
      .toBe('Every Monday at 09:00');
  });

  it('describes every day at 09:00', () => {
    expect(cronExpressionDescription({ hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }))
      .toBe('Every day at 09:00');
  });

  it('describes weekdays at 08:30', () => {
    const desc = cronExpressionDescription({ hour: 8, minute: 30, daysOfWeek: [1, 2, 3, 4, 5], daysOfMonth: [] });
    expect(desc).toBe('Every Mon, Tue, Wed, Thu, Fri at 08:30');
  });

  it('describes 1st of month at 09:00', () => {
    const desc = cronExpressionDescription({ hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1] });
    expect(desc).toBe('Every 1st of month at 09:00');
  });

  it('describes 1st and 15th of month at 09:00', () => {
    const desc = cronExpressionDescription({ hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1, 15] });
    expect(desc).toBe('Every 1st, 15th of month at 09:00');
  });
});
