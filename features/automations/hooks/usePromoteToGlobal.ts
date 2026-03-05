/**
 * Hook for promoting project-scoped automation rules to global scope.
 * Provides duplicate detection, section reference checking, and promotion logic.
 */

import { useCallback } from 'react';
import { findDuplicateGlobalRule } from '../services/rules/duplicateDetector';
import { createFromProjectRule, type PromoteRuleOptions } from '../services/rules/ruleFactory';
import type { AutomationRule } from '../types';

export interface UsePromoteToGlobalResult {
  checkDuplicate: (sourceRule: AutomationRule) => AutomationRule | null;
  hasSectionRefs: (sourceRule: AutomationRule) => boolean;
  promote: (
    sourceRule: AutomationRule,
    options: PromoteRuleOptions & { deleteOriginal?: boolean }
  ) => void;
}

/**
 * Hook for promoting project-scoped automation rules to global scope.
 *
 * @param globalRules - Array of existing global rules for duplicate detection
 * @param allSections - All sections in the app for section name lookup
 * @param createRule - Callback to create the new global rule
 * @param onDeleteOriginal - Callback to delete the original project rule
 * @returns Hook result with checkDuplicate, hasSectionRefs, and promote functions
 */
export function usePromoteToGlobal(
  globalRules: AutomationRule[],
  allSections: Array<{ id: string; name: string; projectId: string | null }>,
  createRule: (rule: AutomationRule) => void,
  onDeleteOriginal: (ruleId: string) => void
): UsePromoteToGlobalResult {
  const checkDuplicate = useCallback(
    (sourceRule: AutomationRule): AutomationRule | null => {
      return findDuplicateGlobalRule(sourceRule, globalRules);
    },
    [globalRules]
  );

  const hasSectionRefs = useCallback(
    (sourceRule: AutomationRule): boolean => {
      const triggerHasSection = 'sectionId' in sourceRule.trigger && sourceRule.trigger.sectionId !== null;
      const actionHasSection = 'sectionId' in sourceRule.action && sourceRule.action.sectionId !== null;
      return triggerHasSection || actionHasSection;
    },
    []
  );

  const promote = useCallback(
    (
      sourceRule: AutomationRule,
      options: PromoteRuleOptions & { deleteOriginal?: boolean }
    ): void => {
      const { deleteOriginal = false, ...promotionOptions } = options;

      // Create the global rule from the project rule
      const globalRule = createFromProjectRule(
        sourceRule,
        promotionOptions,
        globalRules,
        allSections
      );

      // Create the new global rule
      createRule(globalRule);

      // Delete the original project rule if requested
      if (deleteOriginal) {
        onDeleteOriginal(sourceRule.id);
      }
    },
    [globalRules, allSections, createRule, onDeleteOriginal]
  );

  return { checkDuplicate, hasSectionRefs, promote };
}
