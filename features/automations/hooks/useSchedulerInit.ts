import { useEffect, useRef } from 'react';
import { SchedulerLeaderElection } from '../services/scheduler/schedulerLeaderElection';
import { schedulerService } from '@/lib/serviceContainer';

// Module-level singleton to prevent multiple scheduler instances from HMR/strict mode
let activeElection: SchedulerLeaderElection | null = null;

/**
 * Initializes the scheduler leader election on mount (client-side only).
 * Only the leader tab runs the SchedulerService tick loop.
 * Call this once in the root layout/component.
 *
 * Uses a module-level singleton to prevent duplicate schedulers from
 * React strict mode double-effects or HMR re-evaluation.
 */
export function useSchedulerInit(): void {
  useEffect(() => {
    // If an election already exists (HMR or strict mode), destroy it first
    if (activeElection) {
      activeElection.destroy();
      activeElection = null;
    }

    activeElection = new SchedulerLeaderElection(
      () => schedulerService.start(),
      () => schedulerService.stop(),
    );

    return () => {
      if (activeElection) {
        activeElection.destroy();
        activeElection = null;
      }
    };
  }, []);
}
