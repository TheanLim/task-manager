/**
 * useFVPSessionState — derives FVP session display state from the store.
 *
 * React hook (UI layer) — store imports are permitted here.
 * Arch rule #2 applies to services/handlers/utilities only.
 *
 * Ref: tasks.md T-17
 */

import { useMemo } from 'react';
import { Task } from '@/types';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { getCurrentX, getScanCandidate } from '@/features/tms/handlers/fvp';

export interface FVPSessionState {
  isInSnapshot: (taskId: string) => boolean;
  isOutsideFilter: (taskId: string) => boolean;
  progress: number;
  total: number;
  isFiltered: boolean;
  /** True when a preselection scan is in progress (scan candidate exists). */
  selectionInProgress: boolean;
  /** The reference task X for the current comparison, or null if not in a scan. */
  currentX: Task | null;
}

const EMPTY_STATE: FVPSessionState = {
  isInSnapshot: () => false,
  isOutsideFilter: () => false,
  progress: 0,
  total: 0,
  isFiltered: false,
  selectionInProgress: false,
  currentX: null,
};

export function useFVPSessionState(visibleTasks: Task[]): FVPSessionState {
  const activeSystem = useTMSStore((s) => s.state.activeSystem);
  const fvpState = useTMSStore((s) => s.state.systemStates['fvp']) as
    | { dottedTasks: string[]; scanPosition: number; snapshotTaskIds: string[] }
    | undefined;

  return useMemo(() => {
    if (activeSystem !== 'fvp') {
      return EMPTY_STATE;
    }

    const snapshotTaskIds = fvpState?.snapshotTaskIds ?? [];
    const snapshotSet = new Set(snapshotTaskIds);
    const visibleTaskIds = new Set(visibleTasks.map((t) => t.id));

    const isInSnapshot = (taskId: string) => snapshotSet.has(taskId);

    const isOutsideFilter = (taskId: string) =>
      snapshotSet.has(taskId) && !visibleTaskIds.has(taskId);

    // Progress: snapshot IDs that are present in visibleTasks AND not completed
    const progress = snapshotTaskIds.filter((id) => {
      if (!visibleTaskIds.has(id)) return false;
      const task = visibleTasks.find((t) => t.id === id);
      return task !== undefined && !task.completed;
    }).length;

    const total = snapshotTaskIds.length;
    const isFiltered = snapshotTaskIds.length !== visibleTasks.length;

    // Derive the two new fields using existing pure helpers from the FVP handler
    const fvpStateForHelpers = fvpState ?? { dottedTasks: [], scanPosition: 1, snapshotTaskIds: [] };
    const selectionInProgress = getScanCandidate(visibleTasks, fvpStateForHelpers) !== null;
    const currentX = getCurrentX(visibleTasks, fvpStateForHelpers);

    return { isInSnapshot, isOutsideFilter, progress, total, isFiltered, selectionInProgress, currentX };
  }, [activeSystem, fvpState, visibleTasks]);
}
