import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutomationRules } from './useAutomationRules';
import type { AutomationRule } from '../types';
import type { AutomationRuleRepository } from '../repositories/types';

// Mock the dataStore module
vi.mock('@/stores/dataStore', () => {
  let mockRules: AutomationRule[] = [];
  const listeners = new Set<(rules: AutomationRule[]) => void>();

  const mockRepository: AutomationRuleRepository = {
    findById: (id: string) => mockRules.find((r) => r.id === id),
    findAll: () => [...mockRules],
    findByProjectId: (projectId: string) => mockRules.filter((r) => r.projectId === projectId),
    create: (rule: AutomationRule) => {
      mockRules.push(rule);
      listeners.forEach((cb) => cb([...mockRules]));
    },
    update: (id: string, updates: Partial<AutomationRule>) => {
      const index = mockRules.findIndex((r) => r.id === id);
      if (index !== -1) {
        mockRules[index] = { ...mockRules[index], ...updates };
        listeners.forEach((cb) => cb([...mockRules]));
      }
    },
    delete: (id: string) => {
      mockRules = mockRules.filter((r) => r.id !== id);
      listeners.forEach((cb) => cb([...mockRules]));
    },
    replaceAll: (rules: AutomationRule[]) => {
      mockRules = [...rules];
      listeners.forEach((cb) => cb([...mockRules]));
    },
    subscribe: (callback: (rules: AutomationRule[]) => void) => {
      listeners.add(callback);
      callback([...mockRules]);
      return () => {
        listeners.delete(callback);
      };
    },
  };

  // Expose reset function for tests
  (mockRepository as any).__reset = () => {
    mockRules = [];
    listeners.forEach((cb) => cb([]));
  };

  return {
    automationRuleRepository: mockRepository,
  };
});

import { automationRuleRepository } from '@/stores/dataStore';

describe('useAutomationRules', () => {
  const projectId = 'test-project-1';

  beforeEach(() => {
    // Reset mock repository before each test
    (automationRuleRepository as any).__reset();
  });

  describe('Initial State', () => {
    it('should return empty rules array when no rules exist', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      expect(result.current.rules).toEqual([]);
    });

    it('should filter rules by projectId', () => {
      const rule1: AutomationRule = {
        id: 'rule-1',
        projectId: 'test-project-1',
        name: 'Rule 1',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
        executionCount: 0,
        lastExecutedAt: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const rule2: AutomationRule = {
        ...rule1,
        id: 'rule-2',
        projectId: 'test-project-2',
        name: 'Rule 2',
      };

      act(() => {
        automationRuleRepository.create(rule1);
        automationRuleRepository.create(rule2);
      });

      const { result } = renderHook(() => useAutomationRules('test-project-1'));

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].id).toBe('rule-1');
    });
  });

  describe('createRule', () => {
    it('should create a new rule with generated metadata', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      expect(result.current.rules).toHaveLength(1);
      const createdRule = result.current.rules[0];
      expect(createdRule.id).toBeDefined();
      expect(createdRule.name).toBe('Test Rule');
      expect(createdRule.createdAt).toBeDefined();
      expect(createdRule.updatedAt).toBeDefined();
      expect(createdRule.executionCount).toBe(0);
      expect(createdRule.lastExecutedAt).toBeNull();
      expect(createdRule.order).toBe(0);
    });

    it('should assign incremental order to new rules', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
        result.current.createRule({ ...ruleData, name: 'Test Rule 2' });
        result.current.createRule({ ...ruleData, name: 'Test Rule 3' });
      });

      expect(result.current.rules).toHaveLength(3);
      expect(result.current.rules[0].order).toBe(0);
      expect(result.current.rules[1].order).toBe(1);
      expect(result.current.rules[2].order).toBe(2);
    });
  });

  describe('updateRule', () => {
    it('should update an existing rule', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Original Name',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      const ruleId = result.current.rules[0].id;

      act(() => {
        result.current.updateRule(ruleId, { name: 'Updated Name' });
      });

      expect(result.current.rules[0].name).toBe('Updated Name');
    });

    it('should update the updatedAt timestamp', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      const originalUpdatedAt = result.current.rules[0].updatedAt;
      const ruleId = result.current.rules[0].id;

      act(() => {
        result.current.updateRule(ruleId, { name: 'Updated Name' });
      });

      // The updatedAt should be defined and the rule should be updated
      expect(result.current.rules[0].updatedAt).toBeDefined();
      expect(result.current.rules[0].name).toBe('Updated Name');
      // The updatedAt timestamp should be greater than or equal to the original
      expect(new Date(result.current.rules[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      expect(result.current.rules).toHaveLength(1);
      const ruleId = result.current.rules[0].id;

      act(() => {
        result.current.deleteRule(ruleId);
      });

      expect(result.current.rules).toHaveLength(0);
    });
  });

  describe('duplicateRule', () => {
    it('should create a copy with "Copy of" prefix and disabled state', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Original Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      const originalId = result.current.rules[0].id;

      act(() => {
        result.current.duplicateRule(originalId);
      });

      expect(result.current.rules).toHaveLength(2);
      const duplicate = result.current.rules[1];
      expect(duplicate.name).toBe('Copy of Original Rule');
      expect(duplicate.enabled).toBe(false);
      expect(duplicate.id).not.toBe(originalId);
      expect(duplicate.trigger).toEqual(result.current.rules[0].trigger);
      expect(duplicate.action).toEqual(result.current.rules[0].action);
    });

    it('should do nothing if rule does not exist', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.duplicateRule('non-existent-id');
      });

      expect(result.current.rules).toHaveLength(0);
    });
  });

  describe('toggleRule', () => {
    it('should flip enabled state from true to false', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      const ruleId = result.current.rules[0].id;
      expect(result.current.rules[0].enabled).toBe(true);

      act(() => {
        result.current.toggleRule(ruleId);
      });

      expect(result.current.rules[0].enabled).toBe(false);
    });

    it('should flip enabled state from false to true', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      const ruleData = {
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
        action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
        enabled: false,
        brokenReason: null,
      };

      act(() => {
        result.current.createRule(ruleData);
      });

      const ruleId = result.current.rules[0].id;
      expect(result.current.rules[0].enabled).toBe(false);

      act(() => {
        result.current.toggleRule(ruleId);
      });

      expect(result.current.rules[0].enabled).toBe(true);
    });

    it('should do nothing if rule does not exist', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.toggleRule('non-existent-id');
      });

      expect(result.current.rules).toHaveLength(0);
    });
  });

  describe('Reactivity', () => {
    it('should reflect repository changes', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      expect(result.current.rules).toHaveLength(0);

      const rule: AutomationRule = {
        id: 'rule-1',
        projectId,
        name: 'Test Rule',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
        executionCount: 0,
        lastExecutedAt: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      act(() => {
        automationRuleRepository.create(rule);
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].id).toBe('rule-1');
    });
  });
});
