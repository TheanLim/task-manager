import { describe, it, expect } from 'vitest';
import { isRuleActiveForProject } from './scopeFilter';
import type { AutomationRule } from '../../types';

// Helper to create a minimal rule for testing
function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    projectId: null,
    trigger: { type: 'card_marked_complete', sectionId: null },
    action: { type: 'mark_card_complete', params: {} },
    enabled: true,
    order: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    brokenReason: null,
    bulkPausedAt: null,
    excludedProjectIds: [],
    scope: 'all',
    selectedProjectIds: [],
    ...overrides,
  };
}

describe('isRuleActiveForProject', () => {
  describe('scope: all', () => {
    it('returns true for any projectId when excludedProjectIds is empty', () => {
      const rule = makeRule({ scope: 'all', excludedProjectIds: [] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(true);
      expect(isRuleActiveForProject(rule, 'proj-b')).toBe(true);
      expect(isRuleActiveForProject(rule, 'any-project-id')).toBe(true);
    });

    it('returns false when projectId is in excludedProjectIds', () => {
      const rule = makeRule({ scope: 'all', excludedProjectIds: ['proj-a', 'proj-b'] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(false);
      expect(isRuleActiveForProject(rule, 'proj-b')).toBe(false);
    });

    it('returns true for projectId not in excludedProjectIds', () => {
      const rule = makeRule({ scope: 'all', excludedProjectIds: ['proj-a', 'proj-b'] });
      expect(isRuleActiveForProject(rule, 'proj-c')).toBe(true);
      expect(isRuleActiveForProject(rule, 'proj-d')).toBe(true);
    });
  });

  describe('scope: selected', () => {
    it('returns true when projectId is in selectedProjectIds', () => {
      const rule = makeRule({ scope: 'selected', selectedProjectIds: ['proj-a', 'proj-b'] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(true);
      expect(isRuleActiveForProject(rule, 'proj-b')).toBe(true);
    });

    it('returns false when projectId is NOT in selectedProjectIds', () => {
      const rule = makeRule({ scope: 'selected', selectedProjectIds: ['proj-a', 'proj-b'] });
      expect(isRuleActiveForProject(rule, 'proj-c')).toBe(false);
      expect(isRuleActiveForProject(rule, 'proj-d')).toBe(false);
    });

    it('returns false for any projectId when selectedProjectIds is empty', () => {
      const rule = makeRule({ scope: 'selected', selectedProjectIds: [] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(false);
    });
  });

  describe('scope: all_except', () => {
    it('returns false when projectId is in excludedProjectIds', () => {
      const rule = makeRule({ scope: 'all_except', excludedProjectIds: ['proj-a', 'proj-b'] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(false);
      expect(isRuleActiveForProject(rule, 'proj-b')).toBe(false);
    });

    it('returns true when projectId is NOT in excludedProjectIds', () => {
      const rule = makeRule({ scope: 'all_except', excludedProjectIds: ['proj-a', 'proj-b'] });
      expect(isRuleActiveForProject(rule, 'proj-c')).toBe(true);
      expect(isRuleActiveForProject(rule, 'proj-d')).toBe(true);
    });
  });

  describe('default behavior (undefined scope)', () => {
    it('defaults to all behavior when scope is undefined', () => {
      const rule = makeRule({ scope: undefined as any, excludedProjectIds: [] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(true);
    });

    it('respects excludedProjectIds when scope is undefined (defaults to all)', () => {
      const rule = makeRule({ scope: undefined as any, excludedProjectIds: ['proj-a'] });
      expect(isRuleActiveForProject(rule, 'proj-a')).toBe(false);
      expect(isRuleActiveForProject(rule, 'proj-b')).toBe(true);
    });
  });

  describe('property test: scope selected', () => {
    it('isActive iff projectId is in selectedProjectIds for any combination', () => {
      const testCases = [
        { selected: [], projectId: 'p1', expected: false },
        { selected: ['p1'], projectId: 'p1', expected: true },
        { selected: ['p1'], projectId: 'p2', expected: false },
        { selected: ['p1', 'p2'], projectId: 'p1', expected: true },
        { selected: ['p1', 'p2'], projectId: 'p2', expected: true },
        { selected: ['p1', 'p2'], projectId: 'p3', expected: false },
        { selected: ['p1', 'p2', 'p3'], projectId: 'p2', expected: true },
        { selected: ['p1', 'p2', 'p3'], projectId: 'p4', expected: false },
      ];

      for (const { selected, projectId, expected } of testCases) {
        const rule = makeRule({ scope: 'selected', selectedProjectIds: selected });
        const result = isRuleActiveForProject(rule, projectId);
        expect(result).toBe(expected);
      }
    });
  });
});
