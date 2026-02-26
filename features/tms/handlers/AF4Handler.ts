import { Task, TMSState } from '@/types';

/**
 * Autofocus 4 (AF4) Handler — Pure Functions
 *
 * Algorithm:
 * - List is split by a LINE into Backlog (before) and Active List (after).
 * - Scan Backlog sequentially; work any task that "feels ready".
 *   "Did work" → cross off + re-enter at end of Active List.
 *   "Skip"     → advance to next Backlog task.
 * - When a full Backlog pass completes with NO work done:
 *   switch to Active phase, do ONE pass through Active List, return to Backlog.
 * - When ALL Backlog tasks are crossed off:
 *   Active List becomes new Backlog, draw new line (activeListTaskIds → backlogTaskIds).
 * - Stubborn tasks (passed repeatedly) are flagged as dismissed for review.
 *
 * State:
 *   backlogTaskIds    — ordered IDs before the line
 *   activeListTaskIds — ordered IDs after the line (new tasks always appended here)
 *   currentPosition   — 0-based index into the current phase's list
 *   lastPassHadWork   — did the last Backlog pass do any work?
 *   passStartPosition — where the current pass started (full-pass detection)
 *   dismissedTaskIds  — tasks flagged for dismissal review
 *   phase             — 'backlog' | 'active'
 */

// ─── Derived helpers (pure, exported for UI use) ─────────────────────────────

/** The task currently under the cursor. */
export function getCurrentTask(tasks: Task[], tmsState: TMSState): Task | null {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds } = tmsState.af4;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  if (list.length === 0 || currentPosition >= list.length) return null;
  const id = list[currentPosition];
  return tasks.find(t => t.id === id) ?? null;
}

/** True when we've scanned the entire current list without doing any work. */
export function isFullPassComplete(tmsState: TMSState): boolean {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds, passStartPosition } = tmsState.af4;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  // A full pass is complete when currentPosition has wrapped back to (or past) passStartPosition
  // after visiting every item. We detect this by reaching the end of the list.
  return currentPosition >= list.length;
}

/** True when all backlog tasks have been crossed off. */
export function isBacklogEmpty(tasks: Task[], tmsState: TMSState): boolean {
  return tmsState.af4.backlogTaskIds.every(id => {
    const t = tasks.find(task => task.id === id);
    return !t || t.completed;
  });
}

// ─── Handler operations (pure, return state deltas) ──────────────────────────

/**
 * Initialize AF4 — all current incomplete tasks become the Backlog.
 * New tasks added after this point go to the Active List.
 */
export function initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  const incompleteTasks = tasks.filter(t => !t.completed);
  return {
    af4: {
      backlogTaskIds: incompleteTasks.map(t => t.id),
      activeListTaskIds: [],
      currentPosition: 0,
      lastPassHadWork: false,
      passStartPosition: 0,
      dismissedTaskIds: [],
      phase: 'backlog',
    },
  };
}

/**
 * Display order: Backlog tasks first (in backlog order), then a visual separator,
 * then Active List tasks. Completed tasks are filtered out of both lists.
 * Tasks not in either list (edge case) are appended at the end.
 */
export function getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[] {
  const { backlogTaskIds, activeListTaskIds } = tmsState.af4;
  const allListedIds = new Set([...backlogTaskIds, ...activeListTaskIds]);

  const backlog = backlogTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const active = activeListTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const unlisted = tasks.filter(t => !allListedIds.has(t.id));

  return [...backlog, ...active, ...unlisted];
}

/**
 * New task created — append to end of Active List (it arrived after the line).
 */
export function onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState> {
  return {
    af4: {
      ...tmsState.af4,
      activeListTaskIds: [...tmsState.af4.activeListTaskIds, task.id],
    },
  };
}

/**
 * Task completed externally (e.g. checkbox) — remove from whichever list it's in.
 */
export function onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState> {
  const { backlogTaskIds, activeListTaskIds, currentPosition, phase } = tmsState.af4;
  const inBacklog = backlogTaskIds.includes(task.id);
  const inActive = activeListTaskIds.includes(task.id);
  if (!inBacklog && !inActive) return {};

  const newBacklog = backlogTaskIds.filter(id => id !== task.id);
  const newActive = activeListTaskIds.filter(id => id !== task.id);

  // If the completed task was at or before currentPosition in the current phase list,
  // decrement position to avoid skipping the next task.
  let newPosition = currentPosition;
  const currentList = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  const completedIndex = currentList.indexOf(task.id);
  if (completedIndex !== -1 && completedIndex < currentPosition) {
    newPosition = Math.max(0, currentPosition - 1);
  }

  return {
    af4: {
      ...tmsState.af4,
      backlogTaskIds: newBacklog,
      activeListTaskIds: newActive,
      currentPosition: newPosition,
    },
  };
}

// ─── Working operations (called by UI, return state deltas) ──────────────────

/**
 * User did work on the current task.
 * - Mark it as crossed off (caller handles actual task completion).
 * - Re-enter at end of Active List if not fully done (caller decides).
 * - Advance currentPosition; record that this pass had work.
 */
export function didWork(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds } = tmsState.af4;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  if (currentPosition >= list.length) return {};

  const taskId = list[currentPosition];
  const newBacklog = backlogTaskIds.filter(id => id !== taskId);
  // Re-enter at end of active list
  const newActive = [...activeListTaskIds.filter(id => id !== taskId), taskId];
  const nextPosition = currentPosition; // same index now points to next task (removed current)

  return {
    af4: {
      ...tmsState.af4,
      backlogTaskIds: newBacklog,
      activeListTaskIds: newActive,
      currentPosition: nextPosition,
      lastPassHadWork: true,
    },
  };
}

/**
 * User skips the current task — advance to next in current list.
 */
export function skipTask(tmsState: TMSState): Partial<TMSState> {
  return {
    af4: {
      ...tmsState.af4,
      currentPosition: tmsState.af4.currentPosition + 1,
    },
  };
}

/**
 * Called when we've reached the end of the current list (full pass complete).
 * - If Backlog pass had NO work: switch to Active phase for one pass.
 * - If Backlog pass HAD work: restart Backlog from position 0.
 * - If Active pass complete: return to Backlog from position 0.
 * - If Backlog is now empty: promote Active List to new Backlog.
 */
export function advanceAfterFullPass(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  const { phase, lastPassHadWork, backlogTaskIds, activeListTaskIds } = tmsState.af4;

  // Check if all backlog tasks are done
  const activeBacklog = backlogTaskIds.filter(id => {
    const t = tasks.find(task => task.id === id);
    return t && !t.completed;
  });

  if (activeBacklog.length === 0 && phase === 'backlog') {
    // Promote Active List to new Backlog
    return {
      af4: {
        ...tmsState.af4,
        backlogTaskIds: activeListTaskIds,
        activeListTaskIds: [],
        currentPosition: 0,
        passStartPosition: 0,
        lastPassHadWork: false,
        phase: 'backlog',
      },
    };
  }

  if (phase === 'backlog' && !lastPassHadWork) {
    // No work done in backlog pass → do one Active pass
    return {
      af4: {
        ...tmsState.af4,
        currentPosition: 0,
        passStartPosition: 0,
        phase: 'active',
      },
    };
  }

  // Either backlog pass had work, or active pass just finished → back to backlog
  return {
    af4: {
      ...tmsState.af4,
      currentPosition: 0,
      passStartPosition: 0,
      lastPassHadWork: false,
      phase: 'backlog',
    },
  };
}

/**
 * Flag a task as dismissed (stubborn — user keeps passing it).
 */
export function dismissTask(taskId: string, tmsState: TMSState): Partial<TMSState> {
  if (tmsState.af4.dismissedTaskIds.includes(taskId)) return {};
  return {
    af4: {
      ...tmsState.af4,
      dismissedTaskIds: [...tmsState.af4.dismissedTaskIds, taskId],
    },
  };
}

/**
 * Resolve a dismissed task: 'abandon' removes it entirely, 're-enter' moves it
 * to the Active List, 'defer' just un-dismisses it back into the Backlog.
 */
export function resolveDismissed(
  taskId: string,
  resolution: 'abandon' | 're-enter' | 'defer',
  tmsState: TMSState
): Partial<TMSState> {
  const dismissed = tmsState.af4.dismissedTaskIds.filter(id => id !== taskId);

  if (resolution === 'abandon') {
    return {
      af4: {
        ...tmsState.af4,
        backlogTaskIds: tmsState.af4.backlogTaskIds.filter(id => id !== taskId),
        activeListTaskIds: tmsState.af4.activeListTaskIds.filter(id => id !== taskId),
        dismissedTaskIds: dismissed,
      },
    };
  }

  if (resolution === 're-enter') {
    return {
      af4: {
        ...tmsState.af4,
        backlogTaskIds: tmsState.af4.backlogTaskIds.filter(id => id !== taskId),
        activeListTaskIds: [...tmsState.af4.activeListTaskIds.filter(id => id !== taskId), taskId],
        dismissedTaskIds: dismissed,
      },
    };
  }

  // defer — just remove from dismissed, stays in backlog
  return {
    af4: {
      backlogTaskIds: tmsState.af4.backlogTaskIds,
      activeListTaskIds: tmsState.af4.activeListTaskIds,
      currentPosition: tmsState.af4.currentPosition,
      lastPassHadWork: tmsState.af4.lastPassHadWork,
      passStartPosition: tmsState.af4.passStartPosition,
      dismissedTaskIds: dismissed,
      phase: tmsState.af4.phase,
    },
  };
}
