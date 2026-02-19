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

  describe('reorderRules', () => {
    const createRuleData = (name: string) => ({
      projectId,
      name,
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
      enabled: true,
      brokenReason: null,
    });

    it('should move a rule from first to last position', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
        result.current.createRule(createRuleData('Rule C'));
      });

      const ruleAId = result.current.rules.find((r) => r.name === 'Rule A')!.id;

      act(() => {
        result.current.reorderRules(ruleAId, 2);
      });

      const sorted = [...result.current.rules].sort((a, b) => a.order - b.order);
      expect(sorted.map((r) => r.name)).toEqual(['Rule B', 'Rule C', 'Rule A']);
      expect(sorted.map((r) => r.order)).toEqual([0, 1, 2]);
    });

    it('should move a rule from last to first position', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
        result.current.createRule(createRuleData('Rule C'));
      });

      const ruleCId = result.current.rules.find((r) => r.name === 'Rule C')!.id;

      act(() => {
        result.current.reorderRules(ruleCId, 0);
      });

      const sorted = [...result.current.rules].sort((a, b) => a.order - b.order);
      expect(sorted.map((r) => r.name)).toEqual(['Rule C', 'Rule A', 'Rule B']);
      expect(sorted.map((r) => r.order)).toEqual([0, 1, 2]);
    });

    it('should move a rule to a middle position', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
        result.current.createRule(createRuleData('Rule C'));
        result.current.createRule(createRuleData('Rule D'));
      });

      const ruleAId = result.current.rules.find((r) => r.name === 'Rule A')!.id;

      act(() => {
        result.current.reorderRules(ruleAId, 2);
      });

      const sorted = [...result.current.rules].sort((a, b) => a.order - b.order);
      expect(sorted.map((r) => r.name)).toEqual(['Rule B', 'Rule C', 'Rule A', 'Rule D']);
      expect(sorted.map((r) => r.order)).toEqual([0, 1, 2, 3]);
    });

    it('should produce sequential distinct order values', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
        result.current.createRule(createRuleData('Rule C'));
      });

      const ruleBId = result.current.rules.find((r) => r.name === 'Rule B')!.id;

      act(() => {
        result.current.reorderRules(ruleBId, 0);
      });

      const orders = result.current.rules.map((r) => r.order).sort((a, b) => a - b);
      // All distinct
      expect(new Set(orders).size).toBe(orders.length);
      // Sequential from 0
      expect(orders).toEqual([0, 1, 2]);
    });

    it('should do nothing if rule does not exist', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
      });

      const orderBefore = result.current.rules[0].order;

      act(() => {
        result.current.reorderRules('non-existent-id', 0);
      });

      expect(result.current.rules[0].order).toBe(orderBefore);
    });

    it('should clamp newIndex to valid range', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
        result.current.createRule(createRuleData('Rule C'));
      });

      const ruleAId = result.current.rules.find((r) => r.name === 'Rule A')!.id;

      // newIndex way beyond range — should clamp to last position
      act(() => {
        result.current.reorderRules(ruleAId, 100);
      });

      const sorted = [...result.current.rules].sort((a, b) => a.order - b.order);
      expect(sorted.map((r) => r.name)).toEqual(['Rule B', 'Rule C', 'Rule A']);
      expect(sorted.map((r) => r.order)).toEqual([0, 1, 2]);
    });

    it('should do nothing when moving to same position', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
      });

      const ruleAId = result.current.rules.find((r) => r.name === 'Rule A')!.id;
      const updatedAtBefore = result.current.rules.find((r) => r.name === 'Rule A')!.updatedAt;

      act(() => {
        result.current.reorderRules(ruleAId, 0);
      });

      // Order unchanged, updatedAt unchanged
      expect(result.current.rules.find((r) => r.name === 'Rule A')!.order).toBe(0);
      expect(result.current.rules.find((r) => r.name === 'Rule A')!.updatedAt).toBe(updatedAtBefore);
    });

    it('should only affect rules in the same project', () => {
      const otherProjectRule: AutomationRule = {
        id: 'other-rule',
        projectId: 'other-project',
        name: 'Other Rule',
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
        automationRuleRepository.create(otherProjectRule);
      });

      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
      });

      const ruleBId = result.current.rules.find((r) => r.name === 'Rule B')!.id;

      act(() => {
        result.current.reorderRules(ruleBId, 0);
      });

      // Other project rule should be untouched
      const otherRule = automationRuleRepository.findById('other-rule');
      expect(otherRule!.order).toBe(0);
      expect(otherRule!.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('bulkSetEnabled', () => {
    const createRuleData = (name: string, overrides?: Partial<{ enabled: boolean; brokenReason: string | null }>) => ({
      projectId,
      name,
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
      enabled: overrides?.enabled ?? true,
      brokenReason: overrides?.brokenReason ?? null,
    });

    it('should disable all rules when called with false', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Rule B'));
      });

      expect(result.current.rules.every((r) => r.enabled)).toBe(true);

      act(() => {
        result.current.bulkSetEnabled(false);
      });

      expect(result.current.rules.every((r) => !r.enabled)).toBe(true);
    });

    it('should enable all non-broken rules when called with true', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A', { enabled: false }));
        result.current.createRule(createRuleData('Rule B', { enabled: false }));
      });

      act(() => {
        result.current.bulkSetEnabled(true);
      });

      expect(result.current.rules.every((r) => r.enabled)).toBe(true);
    });

    it('should keep broken rules disabled when enabling all', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A', { enabled: false }));
        result.current.createRule(createRuleData('Broken Rule', { enabled: false, brokenReason: 'section_deleted' }));
      });

      act(() => {
        result.current.bulkSetEnabled(true);
      });

      const ruleA = result.current.rules.find((r) => r.name === 'Rule A');
      const brokenRule = result.current.rules.find((r) => r.name === 'Broken Rule');
      expect(ruleA!.enabled).toBe(true);
      expect(brokenRule!.enabled).toBe(false);
    });

    it('should disable broken rules when disabling all', () => {
      const { result } = renderHook(() => useAutomationRules(projectId));

      act(() => {
        result.current.createRule(createRuleData('Rule A'));
        result.current.createRule(createRuleData('Broken Rule', { enabled: true, brokenReason: 'section_deleted' }));
      });

      act(() => {
        result.current.bulkSetEnabled(false);
      });

      expect(result.current.rules.every((r) => !r.enabled)).toBe(true);
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

// ============================================================================
// Feature: automations-polish, Property 11: Rule reorder produces consistent order fields
// **Validates: Requirements 10.2**
// ============================================================================

import * as fc from 'fast-check';

describe('Property 11: Rule reorder produces consistent order fields', () => {
  const createRuleData = (name: string) => ({
    projectId: 'test-project-1',
    name,
    trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
    action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
    enabled: true,
    brokenReason: null,
  });

  it('for any list of rules and any valid reorder operation, all rules have distinct sequential order values', () => {
    fc.assert(
      fc.property(
        // Generate number of rules (2-15)
        fc.integer({ min: 2, max: 15 }),
        // Generate a seed for picking source and destination indices
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        (numRules, srcSeed, dstSeed) => {
          // Reset repository
          (automationRuleRepository as any).__reset();

          const { result } = renderHook(() => useAutomationRules('test-project-1'));

          // Create N rules
          act(() => {
            for (let i = 0; i < numRules; i++) {
              result.current.createRule(createRuleData(`Rule ${i}`));
            }
          });

          expect(result.current.rules).toHaveLength(numRules);

          // Pick a random source rule and destination index
          const sortedRules = [...result.current.rules].sort((a, b) => a.order - b.order);
          const srcIndex = srcSeed % numRules;
          const dstIndex = dstSeed % numRules;
          const ruleId = sortedRules[srcIndex].id;

          act(() => {
            result.current.reorderRules(ruleId, dstIndex);
          });

          // Verify: all rules still present
          expect(result.current.rules).toHaveLength(numRules);

          // Verify: all order values are distinct
          const orders = result.current.rules.map((r) => r.order);
          expect(new Set(orders).size).toBe(numRules);

          // Verify: order values are sequential starting from 0
          const sortedOrders = [...orders].sort((a, b) => a - b);
          for (let i = 0; i < numRules; i++) {
            expect(sortedOrders[i]).toBe(i);
          }

          // Verify: the moved rule is at the expected position
          const newSorted = [...result.current.rules].sort((a, b) => a.order - b.order);
          const clampedDst = Math.max(0, Math.min(dstIndex, numRules - 1));
          if (srcIndex !== clampedDst) {
            expect(newSorted[clampedDst].id).toBe(ruleId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

