import type { AutomationRule, ExecutionLogEntry } from '../../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns the number of distinct global rules that have at least one
 * section-not-found skip in their recent execution log within the last 30 days.
 *
 * Pure selector — O(n) over the execution log, no side effects.
 * Used to drive the sidebar badge on the "Automations" nav item.
 */
export function countGlobalRulesWithActiveSkips(
  _globalRules: AutomationRule[],
  executionLog: ExecutionLogEntry[]
): number {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const affectedRuleIds = new Set<string>();

  for (const entry of executionLog) {
    if (
      entry.isGlobal &&
      entry.executionType === 'skipped' &&
      entry.skipReason?.includes('not found') &&
      entry.ruleId &&
      new Date(entry.timestamp).getTime() > cutoff
    ) {
      affectedRuleIds.add(entry.ruleId);
    }
  }

  return affectedRuleIds.size;
}
