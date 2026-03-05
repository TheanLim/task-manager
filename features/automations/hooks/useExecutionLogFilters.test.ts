import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExecutionLogFilters } from './useExecutionLogFilters';

// Mock EnrichedLogEntry type
type EnrichedLogEntry = {
  id: string;
  timestamp: string;
  ruleId?: string;
  firingProjectId?: string;
  executionType: 'fired' | 'skipped' | 'error' | 'event' | 'scheduled' | 'catch-up' | 'manual';
};

const makeEntry = (overrides: Partial<EnrichedLogEntry> = {}): EnrichedLogEntry => ({
  id: `entry-${Date.now()}`,
  timestamp: new Date().toISOString(),
  ruleId: 'rule-1',
  firingProjectId: 'proj-1',
  executionType: 'fired',
  ...overrides,
});

describe('useExecutionLogFilters', () => {
  const now = new Date('2026-02-20T12:00:00.000Z').getTime();
  vi.useFakeTimers({ now });

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default filters (all outcomes, 7d range, no rule/project filter)', () => {
    const allEntries: EnrichedLogEntry[] = [makeEntry()];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    expect(result.current.filters.outcome).toBe('all');
    expect(result.current.filters.dateRange).toBe('7d');
    expect(result.current.filters.ruleIds).toEqual([]);
    expect(result.current.filters.projectIds).toEqual([]);
    expect(result.current.filteredEntries).toBe(allEntries);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('initialOutcome param sets initial outcome filter', () => {
    const allEntries: EnrichedLogEntry[] = [makeEntry({ executionType: 'skipped' })];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'skipped'));

    expect(result.current.filters.outcome).toBe('skipped');
  });

  it('setRuleIds updates ruleIds filter and re-derives filteredEntries', () => {
    const allEntries: EnrichedLogEntry[] = [
      makeEntry({ id: '1', ruleId: 'rule-1' }),
      makeEntry({ id: '2', ruleId: 'rule-2' }),
      makeEntry({ id: '3', ruleId: 'rule-3' }),
    ];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    act(() => {
      result.current.setRuleIds(['rule-1', 'rule-2']);
    });

    expect(result.current.filters.ruleIds).toEqual(['rule-1', 'rule-2']);
    expect(result.current.filteredEntries.length).toBe(2);
    expect(result.current.filteredEntries.map(e => e.id)).toEqual(['1', '2']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('setOutcome updates outcome filter', () => {
    const allEntries: EnrichedLogEntry[] = [
      makeEntry({ id: '1', executionType: 'fired' }),
      makeEntry({ id: '2', executionType: 'skipped' }),
      makeEntry({ id: '3', executionType: 'error' }),
    ];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    act(() => {
      result.current.setOutcome('skipped');
    });

    expect(result.current.filters.outcome).toBe('skipped');
    expect(result.current.filteredEntries.length).toBe(1);
    expect(result.current.filteredEntries[0].id).toBe('2');
  });

  it('clearFilters resets all filters to defaults', () => {
    const allEntries: EnrichedLogEntry[] = [
      makeEntry({ id: '1', ruleId: 'rule-1' }),
      makeEntry({ id: '2', ruleId: 'rule-2' }),
    ];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'fired'));

    act(() => {
      result.current.setRuleIds(['rule-1']);
      result.current.setOutcome('skipped');
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters.outcome).toBe('all');
    expect(result.current.filters.dateRange).toBe('7d');
    expect(result.current.filters.ruleIds).toEqual([]);
    expect(result.current.filters.projectIds).toEqual([]);
    expect(result.current.filteredEntries).toBe(allEntries);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters is false when all filters are default', () => {
    const allEntries: EnrichedLogEntry[] = [makeEntry()];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters is true when any filter is non-default', () => {
    const allEntries: EnrichedLogEntry[] = [makeEntry()];
    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    act(() => {
      result.current.setRuleIds(['rule-1']);
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filteredEntries updates reactively when allEntries changes', () => {
    const entry1 = makeEntry({ id: '1' });
    const entry2 = makeEntry({ id: '2' });
    const { result, rerender } = renderHook(
      ({ entries }) => useExecutionLogFilters(entries, 'all'),
      { initialProps: { entries: [entry1] } }
    );

    expect(result.current.filteredEntries.length).toBe(1);

    rerender({ entries: [entry1, entry2] });

    expect(result.current.filteredEntries.length).toBe(2);
  });

  it('dateRange filter works correctly', () => {
    const oldEntry = makeEntry({
      id: 'old',
      timestamp: new Date('2026-02-10T12:00:00.000Z').toISOString(),
    });
    const recentEntry = makeEntry({
      id: 'recent',
      timestamp: new Date('2026-02-19T12:00:00.000Z').toISOString(),
    });
    const allEntries = [oldEntry, recentEntry];

    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    // Default is 7d, so only recent entry should be included
    expect(result.current.filteredEntries.length).toBe(1);
    expect(result.current.filteredEntries[0].id).toBe('recent');

    // Change to 'all' - both should be included
    act(() => {
      result.current.setDateRange('all');
    });
    expect(result.current.filteredEntries.length).toBe(2);

    // Change to '24h' - only recent should be included (within 24 hours)
    act(() => {
      result.current.setDateRange('24h');
    });
    expect(result.current.filteredEntries.length).toBe(1);
    expect(result.current.filteredEntries[0].id).toBe('recent');
  });

  it('projectIds filter works correctly', () => {
    const entry1 = makeEntry({ id: '1', firingProjectId: 'proj-1' });
    const entry2 = makeEntry({ id: '2', firingProjectId: 'proj-2' });
    const entry3 = makeEntry({ id: '3', firingProjectId: 'proj-3' });
    const allEntries = [entry1, entry2, entry3];

    const { result } = renderHook(() => useExecutionLogFilters(allEntries, 'all'));

    act(() => {
      result.current.setProjectIds(['proj-1', 'proj-2']);
    });

    expect(result.current.filters.projectIds).toEqual(['proj-1', 'proj-2']);
    expect(result.current.filteredEntries.length).toBe(2);
    expect(result.current.filteredEntries.map(e => e.id)).toEqual(['1', '2']);
  });

  it('multiple filters are ANDed together', () => {
    const entries = [
      makeEntry({ id: '1', ruleId: 'rule-1', firingProjectId: 'proj-1', executionType: 'fired' }),
      makeEntry({ id: '2', ruleId: 'rule-1', firingProjectId: 'proj-2', executionType: 'fired' }),
      makeEntry({ id: '3', ruleId: 'rule-2', firingProjectId: 'proj-1', executionType: 'skipped' }),
      makeEntry({ id: '4', ruleId: 'rule-2', firingProjectId: 'proj-2', executionType: 'skipped' }),
    ];

    const { result } = renderHook(() => useExecutionLogFilters(entries, 'all'));

    act(() => {
      result.current.setRuleIds(['rule-1']);
      result.current.setProjectIds(['proj-1']);
      result.current.setOutcome('fired');
    });

    // Should only return entry 1 (rule-1 AND proj-1 AND fired)
    expect(result.current.filteredEntries.length).toBe(1);
    expect(result.current.filteredEntries[0].id).toBe('1');
  });
});
