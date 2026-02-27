/**
 * useTMSShortcuts — mode-specific keyboard shortcuts for TMS inline interactions.
 *
 * Registers react-hotkeys-hook bindings that are conditionally enabled based on
 * the active TMS mode. Guards against input context and cross-mode firing.
 *
 * AF4:  p=MadeProgress, d=MarkDone, s=Skip, f=Flag
 * FVP:  y=DotTask, n=SkipCandidate (when selectionInProgress)
 *       b=StartPreselection, d=CompleteCurrent (when !selectionInProgress)
 * DIT:  t=MoveToToday, w=MoveToTomorrow, i=MoveToInbox (when focusedTaskId set)
 *
 * Feature: tms-inline-interactions, Properties 5, 6, 15
 */

import { useHotkeys } from 'react-hotkeys-hook';
import { isInputContext } from '@/features/keyboard/services/inputContext';
import type { Task } from '@/types';

export interface UseTMSShortcutsOptions {
  activeSystem: string;
  candidateTask: Task | null;
  allTasks: Task[];
  selectionInProgress: boolean;
  hasDottedTasks: boolean;
  focusedTaskId: string | null;
  dispatch: (action: unknown) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function useTMSShortcuts({
  activeSystem,
  candidateTask,
  allTasks,
  selectionInProgress,
  hasDottedTasks,
  focusedTaskId,
  dispatch,
  onTaskComplete,
}: UseTMSShortcutsOptions): void {
  const isAF4 = activeSystem === 'af4';
  const isFVP = activeSystem === 'fvp';
  const isDIT = activeSystem === 'dit';
  const af4HasCandidate = isAF4 && candidateTask !== null;
  const fvpScanning = isFVP && selectionInProgress && candidateTask !== null;
  const fvpIdle = isFVP && !selectionInProgress;
  const fvpCanComplete = fvpIdle && hasDottedTasks;
  const ditHasFocus = isDIT && focusedTaskId !== null;

  const opts = { enableOnFormTags: false as const, preventDefault: true };

  // ── AF4 shortcuts ─────────────────────────────────────────────────────────

  useHotkeys('p', () => {
    if (!af4HasCandidate || isInputContext(document.activeElement)) return;
    dispatch({ type: 'MADE_PROGRESS' });
  }, { ...opts, enabled: isAF4 }, [isAF4, af4HasCandidate, dispatch]);

  useHotkeys('d', () => {
    if (isInputContext(document.activeElement)) return;
    if (af4HasCandidate) {
      dispatch({ type: 'MARK_DONE' });
      onTaskComplete(candidateTask!.id, true);
    } else if (fvpCanComplete) {
      dispatch({ type: 'COMPLETE_CURRENT', tasks: allTasks });
    }
  }, { ...opts, enabled: isAF4 || fvpCanComplete }, [isAF4, af4HasCandidate, fvpCanComplete, candidateTask, allTasks, dispatch, onTaskComplete]);

  useHotkeys('s', () => {
    if (!af4HasCandidate || isInputContext(document.activeElement)) return;
    dispatch({ type: 'SKIP_TASK' });
  }, { ...opts, enabled: isAF4 }, [isAF4, af4HasCandidate, dispatch]);

  useHotkeys('f', () => {
    if (!af4HasCandidate || isInputContext(document.activeElement)) return;
    dispatch({ type: 'FLAG_DISMISSED' });
  }, { ...opts, enabled: isAF4 }, [isAF4, af4HasCandidate, dispatch]);

  // ── FVP shortcuts ─────────────────────────────────────────────────────────

  useHotkeys('y', () => {
    if (!fvpScanning || isInputContext(document.activeElement)) return;
    dispatch({ type: 'DOT_TASK', task: candidateTask!, tasks: allTasks });
  }, { ...opts, enabled: isFVP }, [isFVP, fvpScanning, candidateTask, allTasks, dispatch]);

  useHotkeys('n', () => {
    if (!fvpScanning || isInputContext(document.activeElement)) return;
    dispatch({ type: 'SKIP_CANDIDATE', task: candidateTask!, tasks: allTasks });
  }, { ...opts, enabled: isFVP }, [isFVP, fvpScanning, candidateTask, allTasks, dispatch]);

  useHotkeys('b', () => {
    if (!fvpIdle || isInputContext(document.activeElement)) return;
    dispatch({ type: 'START_PRESELECTION', tasks: allTasks });
  }, { ...opts, enabled: isFVP }, [isFVP, fvpIdle, allTasks, dispatch]);

  // ── DIT shortcuts ─────────────────────────────────────────────────────────

  useHotkeys('t', () => {
    if (!ditHasFocus || isInputContext(document.activeElement)) return;
    dispatch({ type: 'MOVE_TO_TODAY', taskId: focusedTaskId! });
  }, { ...opts, enabled: isDIT }, [isDIT, ditHasFocus, focusedTaskId, dispatch]);

  useHotkeys('w', () => {
    if (!ditHasFocus || isInputContext(document.activeElement)) return;
    dispatch({ type: 'MOVE_TO_TOMORROW', taskId: focusedTaskId! });
  }, { ...opts, enabled: isDIT }, [isDIT, ditHasFocus, focusedTaskId, dispatch]);

  useHotkeys('i', () => {
    if (!ditHasFocus || isInputContext(document.activeElement)) return;
    dispatch({ type: 'REMOVE_FROM_SCHEDULE', taskId: focusedTaskId! });
  }, { ...opts, enabled: isDIT }, [isDIT, ditHasFocus, focusedTaskId, dispatch]);
}
