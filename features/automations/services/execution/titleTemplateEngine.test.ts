// Feature: scheduled-triggers-phase-5b, Property 8: Title template interpolation determinism
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FakeClock } from '../scheduler/clock';
import { interpolateTitle } from './titleTemplateEngine';

// ─── Generators ─────────────────────────────────────────────────────────

/** Generates a Date in a reasonable range (2020–2030) */
const arbDate = fc.date({
  min: new Date('2020-01-01T00:00:00Z'),
  max: new Date('2030-12-31T23:59:59Z'),
});

/** Generates a template string mixing placeholders and plain text */
const arbTemplate = fc.stringOf(
  fc.oneof(
    fc.constant('{{date}}'),
    fc.constant('{{weekday}}'),
    fc.constant('{{month}}'),
    fc.constant('{{unknown}}'),
    fc.char().filter((c) => c !== '{' && c !== '}'),
  ),
  { minLength: 0, maxLength: 100 },
);

/** Generates a plain string with no {{ }} placeholders */
const arbPlainText = fc.stringOf(
  fc.char().filter((c) => c !== '{' && c !== '}'),
  { minLength: 0, maxLength: 100 },
);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Property Tests ─────────────────────────────────────────────────────

describe('interpolateTitle — Property 8: Title template interpolation determinism', () => {
  it('same inputs always produce same output (determinism)', () => {
    fc.assert(
      fc.property(arbTemplate, arbDate, (template, date) => {
        const clock = new FakeClock(date);
        const result1 = interpolateTitle(template, clock);
        const result2 = interpolateTitle(template, clock);
        expect(result1).toBe(result2);
      }),
      { numRuns: 150 },
    );
  });

  it('no-placeholder templates return unchanged (identity)', () => {
    fc.assert(
      fc.property(arbPlainText, arbDate, (template, date) => {
        const clock = new FakeClock(date);
        expect(interpolateTitle(template, clock)).toBe(template);
      }),
      { numRuns: 150 },
    );
  });

  it('{{date}} resolves to YYYY-MM-DD format', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        const result = interpolateTitle('{{date}}', clock);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Verify it matches the clock's date
        const expected = clock.toDate().toISOString().slice(0, 10);
        expect(result).toBe(expected);
      }),
      { numRuns: 150 },
    );
  });

  it('{{weekday}} resolves to full weekday name (Monday–Sunday)', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        const result = interpolateTitle('{{weekday}}', clock);
        expect(WEEKDAYS).toContain(result);
        expect(result).toBe(WEEKDAYS[clock.toDate().getDay()]);
      }),
      { numRuns: 150 },
    );
  });

  it('{{month}} resolves to full month name (January–December)', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        const result = interpolateTitle('{{month}}', clock);
        expect(MONTHS).toContain(result);
        expect(result).toBe(MONTHS[clock.toDate().getMonth()]);
      }),
      { numRuns: 150 },
    );
  });

  it('{{unknown}} placeholders are left as-is in output', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        const result = interpolateTitle('prefix {{unknown}} suffix', clock);
        expect(result).toBe('prefix {{unknown}} suffix');
      }),
      { numRuns: 100 },
    );
  });

  it('multiple placeholders are all replaced in a single template', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        const d = clock.toDate();
        const template = '{{date}} - {{weekday}} - {{month}}';
        const result = interpolateTitle(template, clock);
        const expected = `${d.toISOString().slice(0, 10)} - ${WEEKDAYS[d.getDay()]} - ${MONTHS[d.getMonth()]}`;
        expect(result).toBe(expected);
      }),
      { numRuns: 150 },
    );
  });
});

// ─── Unit Tests (specific examples with FakeClock) ──────────────────────

describe('interpolateTitle — unit tests', () => {
  it('resolves {{date}} for 2024-01-15', () => {
    const clock = new FakeClock(new Date('2024-01-15T10:30:00Z'));
    expect(interpolateTitle('Standup — {{date}}', clock)).toBe('Standup — 2024-01-15');
  });

  it('resolves {{weekday}} for a Monday', () => {
    // 2024-01-15 is a Monday
    const clock = new FakeClock(new Date('2024-01-15T10:30:00Z'));
    expect(interpolateTitle('Weekly Review — {{weekday}}', clock)).toBe('Weekly Review — Monday');
  });

  it('resolves {{month}} for January', () => {
    const clock = new FakeClock(new Date('2024-01-15T10:30:00Z'));
    expect(interpolateTitle('Report — {{month}}', clock)).toBe('Report — January');
  });

  it('handles empty template', () => {
    const clock = new FakeClock(new Date('2024-01-15T10:30:00Z'));
    expect(interpolateTitle('', clock)).toBe('');
  });

  it('handles repeated placeholders', () => {
    const clock = new FakeClock(new Date('2024-01-15T10:30:00Z'));
    expect(interpolateTitle('{{date}} and {{date}}', clock)).toBe('2024-01-15 and 2024-01-15');
  });
});

// ─── {{day}} alias tests ────────────────────────────────────────────────

describe('interpolateTitle — {{day}} alias for {{date}}', () => {
  it('{{day}} resolves to YYYY-MM-DD format (same as {{date}})', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        const result = interpolateTitle('{{day}}', clock);
        const expected = clock.toDate().toISOString().slice(0, 10);
        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('{{day}} and {{date}} produce identical output', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const clock = new FakeClock(date);
        expect(interpolateTitle('{{day}}', clock)).toBe(interpolateTitle('{{date}}', clock));
      }),
      { numRuns: 100 },
    );
  });

  it('{{day}} works in a mixed template', () => {
    const clock = new FakeClock(new Date('2024-01-15T10:30:00Z'));
    expect(interpolateTitle('Standup — {{day}}', clock)).toBe('Standup — 2024-01-15');
  });
});
