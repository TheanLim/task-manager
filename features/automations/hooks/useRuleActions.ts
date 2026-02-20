/**
 * Hook for rule-level actions: dry-run preview, run-now, and bulk schedule operations.
 * Extracted from AutomationTab to separate action orchestration from UI rendering.
 */

import { useState, useCallback, useMemo } from 'react';
import { toast as sonnerToast } from 'sonner';
import { dryRunScheduledRule, type DryRunResult } from '../services/rules/dryRunService';
import { evaluateRules } from '../services/evaluation/ruleEngine';
import { isScheduledTrigger } from '../types';
import { useDataStore } from '@/stores/dataStore';
import { schedulerService, bulkScheduleService } from '@/lib/serviceContainer';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

export interface UseRuleActionsReturn {
  // Dry-run
  dryRunResult: DryRunResult | null;
  dryRunOpen: boolean;
  setDryRunOpen: (open: boolean) => void;
  handlePreview: (ruleId: string) => void;

  // Run now
  handleRunNow: (ruleId: string) => void;

  // Bulk schedule
  scheduledCount: number;
  eventDrivenCount: number;
  handleBulkPauseScheduled: () => void;
  handleBulkResumeScheduled: () => void;
}

export function useRuleActions(
  rules: AutomationRule[],
  sections: Section[],
  projectId: string,
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void,
): UseRuleActionsReturn {
  // Dry-run state
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunOpen, setDryRunOpen] = useState(false);

  // Scheduled vs event-driven counts
  const { scheduledCount, eventDrivenCount } = useMemo(() => {
    let scheduled = 0;
    let eventDriven = 0;
    for (const rule of rules) {
      if (isScheduledTrigger(rule.trigger)) {
        scheduled++;
      } else {
        eventDriven++;
      }
    }
    return { scheduledCount: scheduled, eventDrivenCount: eventDriven };
  }, [rules]);

  const handlePreview = useCallback((ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || !isScheduledTrigger(rule.trigger)) return;

    const tasks = useDataStore.getState().tasks;
    const result = dryRunScheduledRule(
      rule,
      Date.now(),
      tasks,
      sections,
      (event, context) => evaluateRules(event, [rule], context),
    );
    setDryRunResult(result);
    setDryRunOpen(true);
  }, [rules, sections]);

  const handleRunNow = useCallback((ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || !isScheduledTrigger(rule.trigger)) return;

    schedulerService.evaluateSingleRule(rule);
    onShowToast?.(`Rule "${rule.name}" executed manually.`, 'success');
  }, [rules, onShowToast]);

  const handleBulkPauseScheduled = useCallback(() => {
    const result = bulkScheduleService.pauseAllScheduled(projectId);
    if (result.pausedCount > 0) {
      sonnerToast.success(`⏸️ Paused ${result.pausedCount} scheduled rules`, {
        action: {
          label: 'Undo',
          onClick: () => {
            bulkScheduleService.resumeAllScheduled(projectId);
          },
        },
      });
    }
  }, [projectId]);

  const handleBulkResumeScheduled = useCallback(() => {
    const result = bulkScheduleService.resumeAllScheduled(projectId);
    if (result.resumedCount > 0) {
      sonnerToast.success(`▶️ Resumed ${result.resumedCount} scheduled rules`, {
        action: {
          label: 'Undo',
          onClick: () => {
            bulkScheduleService.pauseAllScheduled(projectId);
          },
        },
      });
    }
  }, [projectId]);

  return {
    dryRunResult,
    dryRunOpen,
    setDryRunOpen,
    handlePreview,
    handleRunNow,
    scheduledCount,
    eventDrivenCount,
    handleBulkPauseScheduled,
    handleBulkResumeScheduled,
  };
}
