import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutomationRules } from './useAutomationRules';
import type { AutomationRule } from '../types';
import type { AutomationRuleRepository } from '../repositories/types';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for useAutomationRules Hook
 * 
 * Feature: automations-ui
 * 
 * These tests verify universal properties that should hold across all valid inputs.
 */

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

// Arbitraries for generating test data
const triggerTypeArb = fc.constantFrom(
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete'
);

const actionTypeArb = fc.constantFrom(
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date'
);

const relativeDateOptionArb = fc.constantFrom('today', 'tomorrow', 'next_working_day');

const positionArb = fc.constantFrom('top', 'bottom');

const triggerArb = fc.record({
  type: triggerTypeArb,
  sectionId: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 })),
});

const actionArb = fc.record({
  type: actionTypeArb,
  sectionId: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 })),
  dateOption: fc.oneof(fc.constant(null), relativeDateOptionArb),
  position: fc.oneof(fc.constant(null), positionArb),
});

const automationRuleDataArb = fc.record({
  projectId: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 200 }),
  trigger: triggerArb,
  action: actionArb,
  enabled: fc.boolean(),
  brokenReason: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
});

describe('useAutomationRules - Property-Based Tests', () => {
  beforeEach(() => {
    // Reset mock repository before each test
    (automationRuleRepository as any).__reset();
  });

  /**
   * Property 16: Hook returns correct rules and reflects repository changes
   * 
   * **Validates: Requirements 12.1, 12.3**
   * 
   * For any sequence of create, update, and delete operations on the AutomationRuleRepository
   * for a given project, the useAutomationRules hook should return exactly the current set
   * of rules for that project after each operation.
   */
  it('Property 16: Hook returns correct rules and reflects repository changes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // projectId
        fc.array(automationRuleDataArb, { minLength: 1, maxLength: 10 }), // rules to create
        (projectId, ruleDatas) => {
          // Reset repository
          (automationRuleRepository as any).__reset();

          const { result } = renderHook(() => useAutomationRules(projectId));

          // Initially should be empty
          expect(result.current.rules).toHaveLength(0);

          // Create rules
          const createdIds: string[] = [];
          act(() => {
            ruleDatas.forEach((ruleData) => {
              result.current.createRule({ ...ruleData, projectId });
            });
          });

          // Hook should reflect all created rules
          expect(result.current.rules).toHaveLength(ruleDatas.length);
          result.current.rules.forEach((rule) => {
            expect(rule.projectId).toBe(projectId);
            createdIds.push(rule.id);
          });

          // Update first rule if exists
          if (createdIds.length > 0) {
            const newName = 'Updated Name';
            act(() => {
              result.current.updateRule(createdIds[0], { name: newName });
            });

            // Hook should reflect the update
            const updatedRule = result.current.rules.find((r) => r.id === createdIds[0]);
            expect(updatedRule?.name).toBe(newName);
            expect(result.current.rules).toHaveLength(ruleDatas.length);
          }

          // Delete first rule if exists
          if (createdIds.length > 0) {
            act(() => {
              result.current.deleteRule(createdIds[0]);
            });

            // Hook should reflect the deletion
            expect(result.current.rules).toHaveLength(ruleDatas.length - 1);
            expect(result.current.rules.find((r) => r.id === createdIds[0])).toBeUndefined();
          }

          // Verify all remaining rules belong to the correct project
          result.current.rules.forEach((rule) => {
            expect(rule.projectId).toBe(projectId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Duplicate creates copy with correct name and disabled state
   * 
   * **Validates: Requirements 10.3**
   * 
   * For any existing AutomationRule with name N, duplicating it should create a new rule
   * with name "Copy of N", enabled: false, and identical trigger and action configuration.
   */
  it('Property 13: Duplicate creates copy with correct name and disabled state', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // projectId
        automationRuleDataArb, // original rule data
        (projectId, ruleData) => {
          // Reset repository
          (automationRuleRepository as any).__reset();

          const { result } = renderHook(() => useAutomationRules(projectId));

          // Create original rule
          act(() => {
            result.current.createRule({ ...ruleData, projectId });
          });

          expect(result.current.rules).toHaveLength(1);
          const original = result.current.rules[0];

          // Duplicate the rule
          act(() => {
            result.current.duplicateRule(original.id);
          });

          // Should now have 2 rules
          expect(result.current.rules).toHaveLength(2);

          // Find the duplicate (the one that's not the original)
          const duplicate = result.current.rules.find((r) => r.id !== original.id);
          expect(duplicate).toBeDefined();

          if (duplicate) {
            // Verify duplicate properties
            expect(duplicate.name).toBe(`Copy of ${original.name}`);
            expect(duplicate.enabled).toBe(false);
            expect(duplicate.projectId).toBe(original.projectId);
            expect(duplicate.trigger).toEqual(original.trigger);
            expect(duplicate.action).toEqual(original.action);
            expect(duplicate.id).not.toBe(original.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Toggle flips enabled state (idempotence)
   * 
   * **Validates: Requirements 10.6**
   * 
   * For any AutomationRule, toggling it twice should return it to its original enabled state.
   * A single toggle should flip enabled from true to false or vice versa.
   */
  it('Property 14: Toggle flips enabled state (idempotence)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // projectId
        automationRuleDataArb, // rule data
        (projectId, ruleData) => {
          // Reset repository
          (automationRuleRepository as any).__reset();

          const { result } = renderHook(() => useAutomationRules(projectId));

          // Create rule
          act(() => {
            result.current.createRule({ ...ruleData, projectId });
          });

          expect(result.current.rules).toHaveLength(1);
          const ruleId = result.current.rules[0].id;
          const originalEnabledState = result.current.rules[0].enabled;

          // First toggle
          act(() => {
            result.current.toggleRule(ruleId);
          });

          const afterFirstToggle = result.current.rules[0].enabled;
          expect(afterFirstToggle).toBe(!originalEnabledState);

          // Second toggle (should return to original state)
          act(() => {
            result.current.toggleRule(ruleId);
          });

          const afterSecondToggle = result.current.rules[0].enabled;
          expect(afterSecondToggle).toBe(originalEnabledState);
        }
      ),
      { numRuns: 100 }
    );
  });
});
