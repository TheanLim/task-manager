import { useState, useEffect, useCallback } from 'react';
import { automationRuleRepository } from '@/stores/dataStore';
import type { AutomationRule } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper function to create a new automation rule with generated metadata.
 * Centralizes id generation, timestamps, and order calculation.
 */
function createRuleWithMetadata(
  data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'order'>,
  existingRules: AutomationRule[]
): AutomationRule {
  const now = new Date().toISOString();
  const maxOrder = existingRules.reduce((max, rule) => Math.max(max, rule.order), -1);
  
  return {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    lastExecutedAt: null,
    order: maxOrder + 1,
  };
}

export interface UseAutomationRulesReturn {
  rules: AutomationRule[];
  createRule: (data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'order'>) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteRule: (id: string) => void;
  duplicateRule: (id: string) => void;
  toggleRule: (id: string) => void;
}

/**
 * React hook for managing automation rules for a specific project.
 * Provides reactive access to rules and CRUD operations.
 *
 * Validates Requirements: 12.1, 12.2, 12.3, 10.1, 10.3, 10.6
 */
export function useAutomationRules(projectId: string): UseAutomationRulesReturn {
  // Subscribe to repository changes using useState + useEffect
  const [rules, setRules] = useState<AutomationRule[]>(() => 
    automationRuleRepository.findByProjectId(projectId)
  );

  useEffect(() => {
    // Subscribe to repository changes
    const unsubscribe = automationRuleRepository.subscribe((allRules) => {
      // Filter rules for this project
      const projectRules = allRules.filter((rule) => rule.projectId === projectId);
      setRules(projectRules);
    });

    return unsubscribe;
  }, [projectId]);

  // Create a new rule
  const createRule = useCallback(
    (data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'order'>) => {
      const allRules = automationRuleRepository.findAll();
      const newRule = createRuleWithMetadata(data, allRules);
      automationRuleRepository.create(newRule);
    },
    []
  );

  // Update an existing rule
  const updateRule = useCallback((id: string, updates: Partial<AutomationRule>) => {
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    automationRuleRepository.update(id, updatedData);
  }, []);

  // Delete a rule
  const deleteRule = useCallback((id: string) => {
    automationRuleRepository.delete(id);
  }, []);

  // Duplicate a rule
  const duplicateRule = useCallback(
    (id: string) => {
      const original = automationRuleRepository.findById(id);
      if (!original) return;

      const allRules = automationRuleRepository.findAll();
      const copy = createRuleWithMetadata(
        {
          projectId: original.projectId,
          name: `Copy of ${original.name}`,
          trigger: original.trigger,
          action: original.action,
          enabled: false,
          brokenReason: original.brokenReason,
        },
        allRules
      );

      automationRuleRepository.create(copy);
    },
    []
  );

  // Toggle rule enabled state
  const toggleRule = useCallback((id: string) => {
    const rule = automationRuleRepository.findById(id);
    if (!rule) return;

    automationRuleRepository.update(id, {
      enabled: !rule.enabled,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  return {
    rules,
    createRule,
    updateRule,
    deleteRule,
    duplicateRule,
    toggleRule,
  };
}
