import { describe, it, expect } from 'vitest';
import { countGlobalRulesWithActiveSkips } from './skipSelectors';
import type { ExecutionLogEntry } from '../../types';

function makeSkipEntry(overrides: Partial<ExecutionLogEntry> = {}): ExecutionLogEntry {
  return {
    timestamp: new Date().toISOString(),
    triggerDescription: 'Card moved into section',
    actionDescription: 'Mark complete',
    taskName: '',
    executionType: 'skipped',
    isGlobal: true,
    ruleId: 'rule-1',
    skipReason: "Section 'Done' not found in project 'Alpha'",
    ...overrides,
  };
}

describe('countGlobalRulesWithActiveSkips', () => {
  it('returns 0 when log is empty', () => {
    expect(countGlobalRulesWithActiveSkips([], [])).toBe(0);
  });

  it('returns 0 when no skipped entries exist', () => {
    const log: ExecutionLogEntry[] = [
      makeSkipEntry({ executionType: 'event' }),
    ];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('returns 1 when one global rule has a skip within 30 days', () => {
    const log = [makeSkipEntry({ ruleId: 'rule-1' })];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(1);
  });

  it('returns 2 when two distinct global rules have skips', () => {
    const log = [
      makeSkipEntry({ ruleId: 'rule-1' }),
      makeSkipEntry({ ruleId: 'rule-2' }),
    ];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(2);
  });

  it('does not count the same ruleId twice (dedup)', () => {
    const log = [
      makeSkipEntry({ ruleId: 'rule-1' }),
      makeSkipEntry({ ruleId: 'rule-1' }),
      makeSkipEntry({ ruleId: 'rule-1' }),
    ];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(1);
  });

  it('ignores skips older than 30 days', () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const log = [makeSkipEntry({ ruleId: 'rule-1', timestamp: oldDate })];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('counts a skip exactly at the 30-day boundary as expired', () => {
    // Exactly 30 days ago is NOT within the window (strictly greater than cutoff)
    const exactBoundary = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const log = [makeSkipEntry({ ruleId: 'rule-1', timestamp: exactBoundary })];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('ignores non-global skipped entries (isGlobal: false)', () => {
    const log = [makeSkipEntry({ ruleId: 'rule-1', isGlobal: false })];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('ignores non-global skipped entries (isGlobal: undefined)', () => {
    const log = [makeSkipEntry({ ruleId: 'rule-1', isGlobal: undefined })];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('ignores skipped entries without skipReason containing "not found"', () => {
    const log = [
      makeSkipEntry({ ruleId: 'rule-1', skipReason: 'Catch-up suppressed by skip_missed policy' }),
    ];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('ignores entries without a ruleId', () => {
    const log = [makeSkipEntry({ ruleId: undefined })];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(0);
  });

  it('handles a mix of valid and invalid entries correctly', () => {
    const log = [
      makeSkipEntry({ ruleId: 'rule-1' }),                                          // counts
      makeSkipEntry({ ruleId: 'rule-2' }),                                          // counts
      makeSkipEntry({ ruleId: 'rule-3', isGlobal: false }),                         // ignored
      makeSkipEntry({ ruleId: 'rule-4', executionType: 'event' }),                  // ignored
      makeSkipEntry({ ruleId: 'rule-5', skipReason: 'skip_missed policy' }),        // ignored
      makeSkipEntry({ ruleId: 'rule-1' }),                                          // dedup
      makeSkipEntry({ ruleId: 'rule-6', timestamp: new Date(0).toISOString() }),    // too old
    ];
    expect(countGlobalRulesWithActiveSkips([], log)).toBe(2);
  });
});
