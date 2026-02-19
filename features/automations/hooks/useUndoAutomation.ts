import { useCallback, useSyncExternalStore } from 'react';
import { getUndoSnapshot, clearUndoSnapshot, performUndo } from '../services/automationService';
import { taskRepository } from '@/stores/dataStore';

/**
 * Return type for the useUndoAutomation hook.
 */
export interface UseUndoAutomationReturn {
  /** Whether an undo action is currently available (snapshot exists and hasn't expired) */
  canUndo: boolean;
  /** Human-readable description of what will be undone, e.g. "Undo: My Rule" */
  undoDescription: string | null;
  /** Execute the undo, reverting the last automated action and clearing the snapshot */
  performUndo: () => void;
}

/**
 * Module-level snapshot cache for useSyncExternalStore.
 * We use a revision counter to trigger re-renders when the snapshot changes.
 */
let revision = 0;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  revision++;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): number {
  return revision;
}

/**
 * Notify the hook that the undo snapshot may have changed.
 * Call this after any operation that modifies the undo snapshot
 * (e.g., after a rule executes or after performing undo).
 */
export function notifyUndoChange(): void {
  notifyListeners();
}

/**
 * Hook for accessing undo state and performing undo of the last automation rule execution.
 *
 * - `canUndo` checks if a snapshot exists and hasn't expired (10s window)
 * - `undoDescription` returns "Undo: [ruleName]" from the snapshot
 * - `performUndo` reverts the automated action and clears the snapshot
 *
 * Validates Requirements: 6.1, 6.2, 6.7
 */
export function useUndoAutomation(): UseUndoAutomationReturn {
  // Subscribe to revision changes so the component re-renders when snapshot changes
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const snapshot = getUndoSnapshot();

  const canUndo = snapshot !== null;
  const undoDescription = snapshot ? `Undo: ${snapshot.ruleName}` : null;

  const handlePerformUndo = useCallback(() => {
    const success = performUndo(taskRepository);
    if (success) {
      notifyUndoChange();
    }
  }, []);

  return {
    canUndo,
    undoDescription,
    performUndo: handlePerformUndo,
  };
}
