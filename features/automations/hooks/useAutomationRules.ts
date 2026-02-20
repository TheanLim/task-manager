import { useState, useEffect, useCallback } from 'react';
import { automationRuleRepository, sectionRepository } from '@/stores/dataStore';
import type { AutomationRule } from '../types';
import { duplicateRuleToProject } from '../services/rules/ruleDuplicator';
import { createRuleWithMetadata } from '../services/rules/ruleFactory';

export interface UseAutomationRulesReturn {
  rules: AutomationRule[];
  createRule: (data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'recentExecutions' | 'order'>) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteRule: (id: string) => void;
  duplicateRule: (id: string) => void;
  duplicateToProject: (ruleId: string, targetProjectId: string, sourceSections: import('@/lib/schemas').Section[]) => void;
  toggleRule: (id: string) => void;
  reorderRules: (ruleId: string, newIndex: number) => void;
  bulkSetEnabled: (enabled: boolean) => void;
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
    (data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'recentExecutions' | 'order'>) => {
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
          filters: original.filters,
          action: original.action,
          enabled: false,
          brokenReason: original.brokenReason,
          bulkPausedAt: null,
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

  // Reorder a rule to a new position, updating all affected order fields
  const reorderRules = useCallback(
    (ruleId: string, newIndex: number) => {
      const projectRules = automationRuleRepository
        .findByProjectId(projectId)
        .sort((a, b) => a.order - b.order);

      const currentIndex = projectRules.findIndex((r) => r.id === ruleId);
      if (currentIndex === -1) return;

      // Clamp newIndex to valid range
      const clampedIndex = Math.max(0, Math.min(newIndex, projectRules.length - 1));
      if (clampedIndex === currentIndex) return;

      // Remove from current position and insert at new position
      const [moved] = projectRules.splice(currentIndex, 1);
      projectRules.splice(clampedIndex, 0, moved);

      // Assign sequential order values
      const now = new Date().toISOString();
      for (let i = 0; i < projectRules.length; i++) {
        if (projectRules[i].order !== i) {
          automationRuleRepository.update(projectRules[i].id, {
            order: i,
            updatedAt: now,
          });
        }
      }
    },
    [projectId]
  );

  // Bulk enable or disable all rules for the project
  const bulkSetEnabled = useCallback(
    (enabled: boolean) => {
      const projectRules = automationRuleRepository.findByProjectId(projectId);
      const now = new Date().toISOString();

      for (const rule of projectRules) {
        if (enabled) {
          // "Enable all" skips broken rules (brokenReason !== null stays disabled)
          if (rule.brokenReason !== null) continue;
          if (rule.enabled) continue; // already enabled
          automationRuleRepository.update(rule.id, { enabled: true, updatedAt: now });
        } else {
          // "Disable all" disables every rule
          if (!rule.enabled) continue; // already disabled
          automationRuleRepository.update(rule.id, { enabled: false, updatedAt: now });
        }
      }
    },
    [projectId]
  );

  // Duplicate a rule to another project with section name remapping
  const duplicateToProject = useCallback(
    (ruleId: string, targetProjectId: string, sourceSections: import('@/lib/schemas').Section[]) => {
      const rule = automationRuleRepository.findById(ruleId);
      if (!rule) return;

      const targetSections = sectionRepository.findByProjectId(targetProjectId);
      const newRule = duplicateRuleToProject(rule, targetProjectId, sourceSections, targetSections);
      automationRuleRepository.create(newRule);
    },
    []
  );

  return {
    rules,
    createRule,
    updateRule,
    deleteRule,
    duplicateRule,
    duplicateToProject,
    toggleRule,
    reorderRules,
    bulkSetEnabled,
  };
}
