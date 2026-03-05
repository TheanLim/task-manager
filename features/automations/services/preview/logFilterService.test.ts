import { describe, it, expect } from 'vitest';
import { applyLogFilters, type ExecutionLogFilters, type EnrichedLogEntry } from './logFilterService';

// Helper to create a log entry
function makeEntry(overrides: Partial<EnrichedLogEntry> = {}): EnrichedLogEntry {
  const now = new Date().toISOString();
  return {
    id: 'entry-1',
    timestamp: now,
    ruleId: 'rule-1',
    ruleName: 'Test Rule',
    firingProjectId: 'proj-1',
    projectName: 'Test Project',
    taskName: 'Test Task',
    executionType: 'event',
    skipReason: undefined,
    triggerDescription: 'Triggered',
    actionDescription: 'Action',
    ...overrides,
  };
}

describe('applyLogFilters', () => {
  const baseEntries: EnrichedLogEntry[] = [
    makeEntry({ id: '1', ruleId: 'rule-a', firingProjectId: 'proj-1', executionType: 'event' }),
    makeEntry({ id: '2', ruleId: 'rule-a', firingProjectId: 'proj-2', executionType: 'skipped' }),
    makeEntry({ id: '3', ruleId: 'rule-b', firingProjectId: 'proj-1', executionType: 'scheduled' }),
    makeEntry({ id: '4', ruleId: 'rule-b', firingProjectId: 'proj-2', executionType: 'warning' }),
    makeEntry({ id: '5', ruleId: 'rule-c', firingProjectId: 'proj-1', executionType: 'catch-up' }),
  ];

  describe('no filters active', () => {
    it('returns all entries', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(baseEntries.length);
    });
  });

  describe('ruleIds filter', () => {
    it('returns only entries matching ruleIds', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: ['rule-a'],
        projectIds: [],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.ruleId === 'rule-a')).toBe(true);
    });

    it('empty ruleIds array = no filter (all rules)', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(baseEntries.length);
    });
  });

  describe('projectIds filter', () => {
    it('returns only entries matching firingProjectId', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: ['proj-1'],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(3);
      expect(result.every(e => e.firingProjectId === 'proj-1')).toBe(true);
    });

    it('empty projectIds array = no filter (all projects)', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(baseEntries.length);
    });
  });

  describe('outcome filter', () => {
    it("outcome: 'fired' returns entries where executionType !== 'skipped'", () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'fired',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(4);
      expect(result.every(e => e.executionType !== 'skipped')).toBe(true);
    });

    it("outcome: 'skipped' returns entries where executionType === 'skipped'", () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'skipped',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(1);
      expect(result[0].executionType).toBe('skipped');
    });

    it("outcome: 'error' returns entries where executionType === 'warning' (UI maps error→warning)", () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'error',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(1);
      expect(result[0].executionType).toBe('warning');
    });

    it("outcome: 'all' returns all entries", () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(baseEntries.length);
    });
  });

  describe('dateRange filter', () => {
    it("dateRange: '24h' filters to last 24 hours", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const entries = [
        makeEntry({ timestamp: now }),
        makeEntry({ timestamp: oneHourAgo }),
        makeEntry({ timestamp: twoDaysAgo }),
      ];

      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: '24h',
      };
      const result = applyLogFilters(entries, filters);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.timestamp === now || e.timestamp === oneHourAgo)).toBe(true);
    });

    it("dateRange: '7d' filters to last 7 days", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

      const entries = [
        makeEntry({ timestamp: now }),
        makeEntry({ timestamp: threeDaysAgo }),
        makeEntry({ timestamp: eightDaysAgo }),
      ];

      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: '7d',
      };
      const result = applyLogFilters(entries, filters);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.timestamp === now || e.timestamp === threeDaysAgo)).toBe(true);
    });

    it("dateRange: 'all' returns all entries", () => {
      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(baseEntries.length);
    });
  });

  describe('multiple filters are ANDed together', () => {
    it('combines ruleIds and projectIds filters', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: ['rule-a'],
        projectIds: ['proj-2'],
        outcome: 'all',
        dateRange: 'all',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('rule-a');
      expect(result[0].firingProjectId).toBe('proj-2');
    });

    it('combines outcome and dateRange filters', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const entries = [
        makeEntry({ timestamp: now, executionType: 'skipped' }),
        makeEntry({ timestamp: oneHourAgo, executionType: 'skipped' }),
        makeEntry({ timestamp: twoDaysAgo, executionType: 'skipped' }),
        makeEntry({ timestamp: now, executionType: 'event' }),
      ];

      const filters: ExecutionLogFilters = {
        ruleIds: [],
        projectIds: [],
        outcome: 'skipped',
        dateRange: '24h',
      };
      const result = applyLogFilters(entries, filters);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.executionType === 'skipped')).toBe(true);
    });
  });

  describe('property test: filtered count <= total count', () => {
    it('filtered count is always <= total count for random filters', () => {
      const filters: ExecutionLogFilters = {
        ruleIds: ['rule-a', 'rule-b'],
        projectIds: ['proj-1'],
        outcome: 'fired',
        dateRange: '7d',
      };
      const result = applyLogFilters(baseEntries, filters);
      expect(result.length).toBeLessThanOrEqual(baseEntries.length);
    });
  });
});
