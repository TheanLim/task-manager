/**
 * useTMSModeSelector — manages mode switching UI state.
 *
 * React hook (UI layer) — store imports are permitted here.
 * Arch rule #2 applies to services/handlers/utilities only.
 *
 * Ref: tasks.md T-08
 */

import { useState, useRef, useCallback } from 'react';
import { Task } from '@/types';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { useDataStore } from '@/stores/dataStore';
import { executeTMSSwitch } from '@/features/tms/services/tmsSwitchService';
import { getTMSHandler } from '@/features/tms/registry';
import { buildFvpSnapshot } from '@/features/tms/services/fvpSnapshotService';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if switching away from `systemId` requires a confirmation
 * dialog given the current system state.
 */
function requiresConfirmation(
  systemId: string,
  systemStates: Record<string, unknown>,
): boolean {
  if (systemId === 'none' || systemId === 'standard') return false;

  const state = systemStates[systemId] as Record<string, unknown> | undefined;
  if (!state) return false;

  if (systemId === 'fvp') {
    const dottedTasks = (state.dottedTasks as string[] | undefined) ?? [];
    return dottedTasks.length > 0;
  }

  if (systemId === 'af4') {
    const activeListTaskIds = (state.activeListTaskIds as string[] | undefined) ?? [];
    const backlogTaskIds = (state.backlogTaskIds as string[] | undefined) ?? [];
    return activeListTaskIds.length > 0 || backlogTaskIds.length > 0;
  }

  if (systemId === 'dit') {
    const todayTasks = (state.todayTasks as string[] | undefined) ?? [];
    const tomorrowTasks = (state.tomorrowTasks as string[] | undefined) ?? [];
    return todayTasks.length > 0 || tomorrowTasks.length > 0;
  }

  return false;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseTMSModeSelectorReturn {
  activeSystem: string;
  isPopoverOpen: boolean;
  isConfirmDialogOpen: boolean;
  pendingSystemId: string | null;
  openModeSelector: () => void;
  closePopover: () => void;
  selectMode: (systemId: string, filteredTasks?: Task[]) => void;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
}

export function useTMSModeSelector(
  scrollContainerRef: React.RefObject<HTMLElement>,
): UseTMSModeSelectorReturn {
  const { state, setActiveSystem, applySystemStateDelta, setSystemState } = useTMSStore();
  const tasks = useDataStore((s) => s.tasks);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingSystemId, setPendingSystemId] = useState<string | null>(null);

  // Saved scroll position — captured when a mode activates, restored on exit to 'none'
  const savedScrollTop = useRef<number | null>(null);

  // ── Internal switch executor ───────────────────────────────────────────────

  const performSwitch = useCallback(
    (toId: string, filteredTasks?: Task[]) => {
      const fromId = state.activeSystem;

      // Save scroll position when activating a mode
      if (toId !== 'none' && fromId === 'none') {
        savedScrollTop.current = scrollContainerRef.current?.scrollTop ?? null;
      }

      // Write FVP snapshot before the switch lifecycle runs
      if (toId === 'fvp') {
        const snapshotSource =
          filteredTasks ??
          tasks.filter((t) => !t.completed);
        const snapshotTaskIds = buildFvpSnapshot(snapshotSource);
        applySystemStateDelta('fvp', { snapshotTaskIds });
      }

      const result = executeTMSSwitch(
        fromId,
        toId,
        tasks,
        state.systemStates as Record<string, Record<string, unknown>>,
        getTMSHandler,
      );

      // Apply state updates returned by the switch service
      for (const [systemId, newState] of Object.entries(result.systemStateUpdates)) {
        setSystemState(systemId, newState);
      }

      setActiveSystem(result.newActiveSystem);

      // Restore scroll position when exiting to 'none'
      if (toId === 'none' && savedScrollTop.current !== null) {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollTop.current;
        }
        savedScrollTop.current = null;
      }
    },
    [state, tasks, scrollContainerRef, applySystemStateDelta, setSystemState, setActiveSystem],
  );

  // ── Public API ─────────────────────────────────────────────────────────────

  const openModeSelector = useCallback(() => {
    setIsPopoverOpen(true);
  }, []);

  const closePopover = useCallback(() => {
    setIsPopoverOpen(false);
  }, []);

  const selectMode = useCallback(
    (systemId: string, filteredTasks?: Task[]) => {
      setIsPopoverOpen(false);

      // Switching TO 'none' is always immediate — no dialog
      if (systemId === 'none') {
        performSwitch('none', filteredTasks);
        return;
      }

      const fromId = state.activeSystem;

      if (requiresConfirmation(fromId, state.systemStates as Record<string, unknown>)) {
        setPendingSystemId(systemId);
        setIsConfirmDialogOpen(true);
        return;
      }

      performSwitch(systemId, filteredTasks);
    },
    [state, performSwitch],
  );

  const confirmSwitch = useCallback(() => {
    if (pendingSystemId === null) return;
    const toId = pendingSystemId;
    setPendingSystemId(null);
    setIsConfirmDialogOpen(false);
    performSwitch(toId);
  }, [pendingSystemId, performSwitch]);

  const cancelSwitch = useCallback(() => {
    setPendingSystemId(null);
    setIsConfirmDialogOpen(false);
  }, []);

  return {
    activeSystem: state.activeSystem,
    isPopoverOpen,
    isConfirmDialogOpen,
    pendingSystemId,
    openModeSelector,
    closePopover,
    selectMode,
    confirmSwitch,
    cancelSwitch,
  };
}
