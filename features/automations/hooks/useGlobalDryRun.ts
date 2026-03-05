import { useState, useCallback, useEffect, useMemo } from 'react';
import { runGlobalDryRun, estimateDryRunTaskCount } from '../services/preview/rulePreviewService';
import type { AutomationRule } from '../types';
import type { Task, Section } from '@/lib/schemas';
import type { GlobalDryRunSummary } from '../services/preview/rulePreviewService';

const STALE_THRESHOLD_MS = 60 * 1000; // 60 seconds

// Export for testing - allows using a custom timestamp function
export let getCurrentTime = (): number => Date.now();

export interface UseGlobalDryRunResult {
  summary: GlobalDryRunSummary | null;
  isRunning: boolean;
  isStale: boolean;
  showCountWarning: boolean;
  run: () => void;
  reset: () => void;
}

export function useGlobalDryRun(
  rule: AutomationRule,
  projects: Array<{ id: string; name: string }>,
  allTasks: Task[],
  allSections: Section[]
): UseGlobalDryRunResult {
  const [summary, setSummary] = useState<GlobalDryRunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runAt, setRunAt] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  const showCountWarning = useMemo(() => {
    if (!summary) return false;
    return estimateDryRunTaskCount(rule, projects, allTasks) > 500;
  }, [summary, rule, projects, allTasks]);

  const run = useCallback(() => {
    setIsRunning(true);
    try {
      const result = runGlobalDryRun(rule, projects, allTasks, allSections);
      setSummary(result);
      setRunAt(result.runAt);
    } finally {
      setIsRunning(false);
    }
  }, [rule, projects, allTasks, allSections]);

  const reset = useCallback(() => {
    setSummary(null);
    setRunAt(null);
  }, []);

  // Check staleness based on runAt timestamp
  const isStale = useMemo(() => {
    if (!runAt) return false;
    const elapsed = getCurrentTime() - new Date(runAt).getTime();
    return elapsed > STALE_THRESHOLD_MS;
  }, [runAt, forceUpdate]);

  // Effect to update isStale when time passes (using fake timers in tests)
  useEffect(() => {
    if (!runAt) return;

    // Set up interval to force re-render periodically
    const intervalId = setInterval(() => {
      setForceUpdate((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [runAt]);

  return {
    summary,
    isRunning,
    isStale,
    showCountWarning,
    run,
    reset,
  };
}
