import { useState, useEffect } from 'react';
import { automationRuleRepository } from '@/stores/dataStore';
import { countGlobalRulesWithActiveSkips } from '../services/rules/skipSelectors';
import type { AutomationRule, ExecutionLogEntry } from '../types';

/**
 * Returns the number of global rules that have active section-not-found skips
 * within the last 30 days. Used to drive the amber badge on the sidebar nav item.
 *
 * Does NOT import any Zustand store directly.
 */
export function useGlobalAutomationSkipCount(): number {
  const [count, setCount] = useState<number>(() => {
    const globalRules = automationRuleRepository.findGlobal();
    const log = globalRules.flatMap((r) => r.recentExecutions ?? []) as ExecutionLogEntry[];
    return countGlobalRulesWithActiveSkips(globalRules, log);
  });

  useEffect(() => {
    const unsubscribe = automationRuleRepository.subscribe((allRules: AutomationRule[]) => {
      const globalRules = allRules.filter((r) => r.projectId === null);
      const log = globalRules.flatMap((r) => r.recentExecutions ?? []) as ExecutionLogEntry[];
      setCount(countGlobalRulesWithActiveSkips(globalRules, log));
    });
    return unsubscribe;
  }, []);

  return count;
}
