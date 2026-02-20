/**
 * Tests for formatters.ts.
 * Core logic is also tested via rulePreviewService.test.ts and ruleMetadata.test.ts
 * (backward-compat re-exports). These tests verify the canonical import path.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime, formatDateOption, formatFilterDescription } from './formatters';

describe('formatRelativeTime (canonical import)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns "Just now" for recent timestamps', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(new Date(now - 10_000).toISOString())).toBe('Just now');
  });

  it('returns minutes ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(new Date(now - 3 * 3600_000).toISOString())).toBe('3h ago');
  });

  it('returns days ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(new Date(now - 2 * 86400_000).toISOString())).toBe('2d ago');
  });
});

describe('formatDateOption (canonical import)', () => {
  it('formats today', () => {
    expect(formatDateOption('today')).toBe('today');
  });

  it('formats tomorrow', () => {
    expect(formatDateOption('tomorrow')).toBe('tomorrow');
  });

  it('formats next_working_day', () => {
    expect(formatDateOption('next_working_day')).toBe('next working day');
  });

  it('formats unknown options by replacing underscores', () => {
    expect(formatDateOption('next_monday' as any)).toBe('next monday');
  });
});

describe('formatFilterDescription (canonical import)', () => {
  const sectionLookup = (id: string) => (id === 's1' ? 'Done' : undefined);

  it('describes in_section filter', () => {
    expect(formatFilterDescription({ type: 'in_section', sectionId: 's1' }, sectionLookup))
      .toBe('in "Done"');
  });

  it('describes has_due_date filter', () => {
    expect(formatFilterDescription({ type: 'has_due_date' } as any, sectionLookup))
      .toBe('with a due date');
  });

  it('describes due_in_less_than filter', () => {
    expect(formatFilterDescription(
      { type: 'due_in_less_than', value: 3, unit: 'days' } as any,
      sectionLookup
    )).toBe('due in less than 3 days');
  });

  it('describes due_in_between with working_days', () => {
    expect(formatFilterDescription(
      { type: 'due_in_between', minValue: 1, maxValue: 5, unit: 'working_days' } as any,
      sectionLookup
    )).toBe('due in 1-5 working days');
  });
});
