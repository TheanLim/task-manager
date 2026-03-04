import { useState, useEffect, useCallback } from 'react';
import { automationRuleRepository } from '@/stores/dataStore';
import { createRuleWithMetadata } from '../services/rules/ruleFactory';
import type { AutomationRule } from '../types';

export interface UseGlobalAutomationRulesReturn {
  rules: AutomationRule[];
  createRule: (
    data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'recentExecutions' | 'order'>
  ) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteRule: (id: string) => void;
}

/**
 * Hook for managing global automation rules (projectId === null).
 * Does NOT import any Zustand store directly — reads from the repository.
 */
export function useGlobalAutomationRules(): UseGlobalAutomationRulesReturn {
  const [rules, setRules] = useState<AutomationRule[]>(() =>
    automationRuleRepository.findGlobal()
  );

  useEffect(() => {
    const unsubscribe = automationRuleRepository.subscribe((allRules) => {
      setRules(allRules.filter((r) => r.projectId === null));
    });
    return unsubscribe;
  }, []);

  const createRule = useCallback(
    (
      data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'recentExecutions' | 'order'>
    ) => {
      const allRules = automationRuleRepository.findAll();
      const newRule = createRuleWithMetadata({ ...data, projectId: null }, allRules);
      automationRuleRepository.create(newRule);
    },
    []
  );

  const updateRule = useCallback((id: string, updates: Partial<AutomationRule>) => {
    automationRuleRepository.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }, []);

  const deleteRule = useCallback((id: string) => {
    automationRuleRepository.delete(id);
  }, []);

  return { rules, createRule, updateRule, deleteRule };
}
