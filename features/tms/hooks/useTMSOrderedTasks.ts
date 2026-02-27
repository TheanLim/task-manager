/**
 * useTMSOrderedTasks — returns tasks ordered by the active TMS handler.
 *
 * React hook (UI layer) — store imports are permitted here.
 * Arch rule #2 applies to services/handlers/utilities only.
 *
 * Ref: tasks.md T-16
 */

import { useMemo } from 'react';
import { Task } from '@/types';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { getTMSHandler } from '@/features/tms/registry';

export function useTMSOrderedTasks(filteredTasks: Task[]): Task[] {
  const activeSystem = useTMSStore((s) => s.state.activeSystem);
  const systemState = useTMSStore((s) => s.state.systemStates[activeSystem]);

  return useMemo(() => {
    if (activeSystem === 'none' || activeSystem === 'standard') {
      return filteredTasks;
    }

    const handler = getTMSHandler(activeSystem);
    return handler.getOrderedTasks(filteredTasks, systemState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, activeSystem, systemState]);
}
