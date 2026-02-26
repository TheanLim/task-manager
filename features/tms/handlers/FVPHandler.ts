import { Task, TMSState } from '@/types';

/**
 * Final Version Perfected (FVP) Handler — Pure Functions
 *
 * Algorithm:
 * 1. The first undotted task is implicitly the initial X (no dot needed).
 * 2. Preselection scans forward from scanPosition asking "more than X?".
 *    - Yes → dot the candidate, it becomes the new X, continue scanning.
 *    - No  → skip, continue scanning.
 * 3. The LAST dotted task is always the one to do NOW.
 *    dottedTasks[length-1] = task to do
 *    dottedTasks[length-2] = current X (the comparison reference)
 * 4. After completing the last dotted task:
 *    - Remove it from dottedTasks.
 *    - scanPosition stays AFTER the completed task's position in the full list.
 *    - Resume preselection from there, comparing against the new last dotted task.
 * 5. If dottedTasks becomes empty, reset scanPosition to 1 (skip first task, it's the new X).
 *
 * State:
 *   dottedTasks: string[]  — ordered oldest→newest; last = task to do, second-to-last = X
 *   scanPosition: number   — index in the full task list to resume scanning from
 */

// ─── Derived helpers (pure, exported for UI use) ─────────────────────────────

/** The task the user should do right now (last dotted). */
export function getCurrentTask(tasks: Task[], tmsState: TMSState): Task | null {
  const { dottedTasks } = tmsState.fvp;
  if (dottedTasks.length === 0) return null;
  const id = dottedTasks[dottedTasks.length - 1];
  return tasks.find(t => t.id === id) ?? null;
}

/** The reference task X (second-to-last dotted, or first undotted if only 0-1 dotted). */
export function getCurrentX(tasks: Task[], tmsState: TMSState): Task | null {
  const { dottedTasks } = tmsState.fvp;
  if (dottedTasks.length >= 2) {
    const id = dottedTasks[dottedTasks.length - 2];
    return tasks.find(t => t.id === id) ?? null;
  }
  // X is the first undotted incomplete task
  const dottedSet = new Set(dottedTasks);
  return tasks.find(t => !t.completed && !dottedSet.has(t.id)) ?? null;
}

/** The next candidate task to compare against X during preselection. */
export function getScanCandidate(tasks: Task[], tmsState: TMSState): Task | null {
  const { scanPosition, dottedTasks } = tmsState.fvp;
  const dottedSet = new Set(dottedTasks);
  const incomplete = tasks.filter(t => !t.completed);
  for (let i = scanPosition; i < incomplete.length; i++) {
    if (!dottedSet.has(incomplete[i].id)) {
      return incomplete[i];
    }
  }
  return null;
}

/** True when there are no more candidates to scan — preselection is complete. */
export function isPreselectionComplete(tasks: Task[], tmsState: TMSState): boolean {
  return getScanCandidate(tasks, tmsState) === null;
}

// ─── Handler operations (pure, return state deltas) ──────────────────────────

/**
 * Initialize FVP — reset to clean state so preselection starts fresh.
 */
export function initialize(_tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  return {
    fvp: {
      dottedTasks: [],
      scanPosition: 1, // position 0 is the implicit first X; scan starts at 1
    },
  };
}

/**
 * Order for display: dotted tasks in their dotted order (last = do now),
 * then undotted incomplete tasks in natural order, then completed tasks
 * that are NOT already in the dotted list.
 */
export function getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[] {
  const dottedSet = new Set(tmsState.fvp.dottedTasks);
  const dottedTasks = tmsState.fvp.dottedTasks
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const undotted = tasks.filter(t => !dottedSet.has(t.id) && !t.completed);
  const completed = tasks.filter(t => !dottedSet.has(t.id) && t.completed);
  return [...dottedTasks, ...undotted, ...completed];
}

/**
 * New task created — append to end of the undotted pool.
 * scanPosition doesn't change; the new task will be picked up naturally.
 */
export function onTaskCreated(_task: Task, _tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * Task completed — remove from dotted list if present.
 * Advance scanPosition past the completed task so we don't re-scan it.
 */
export function onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState> {
  const { dottedTasks } = tmsState.fvp;
  if (!dottedTasks.includes(task.id)) return {};

  const newDotted = dottedTasks.filter(id => id !== task.id);
  return {
    fvp: {
      ...tmsState.fvp,
      dottedTasks: newDotted,
      // scanPosition stays where it is — the UI advances it via dotTask/skipTask
    },
  };
}

// ─── Preselection operations (called by UI, return state deltas) ──────────────

/**
 * User answers "Yes, I want to do [candidate] more than X".
 * Dot the candidate; it becomes the new X. Advance scanPosition past it.
 */
export function dotTask(
  candidateTask: Task,
  tasks: Task[],
  tmsState: TMSState
): Partial<TMSState> {
  const incomplete = tasks.filter(t => !t.completed);
  const candidateIndex = incomplete.findIndex(t => t.id === candidateTask.id);
  return {
    fvp: {
      ...tmsState.fvp,
      dottedTasks: [...tmsState.fvp.dottedTasks, candidateTask.id],
      scanPosition: candidateIndex + 1,
    },
  };
}

/**
 * User answers "No" — skip this candidate, advance scanPosition past it.
 * Returns a minimal delta with only scanPosition changed.
 */
export function skipTask(
  candidateTask: Task,
  tasks: Task[],
  tmsState: TMSState
): Partial<TMSState> {
  const incomplete = tasks.filter(t => !t.completed);
  const candidateIndex = incomplete.findIndex(t => t.id === candidateTask.id);
  return {
    fvp: {
      dottedTasks: tmsState.fvp.dottedTasks,
      scanPosition: candidateIndex + 1,
    },
  };
}

/**
 * User completes the current task (last dotted).
 * Remove it from dottedTasks. scanPosition stays after its position in the list.
 */
export function completeCurrentTask(
  tasks: Task[],
  tmsState: TMSState
): Partial<TMSState> {
  const { dottedTasks } = tmsState.fvp;
  if (dottedTasks.length === 0) return {};

  const currentTaskId = dottedTasks[dottedTasks.length - 1];
  const incomplete = tasks.filter(t => !t.completed);
  const completedIndex = incomplete.findIndex(t => t.id === currentTaskId);
  const newDotted = dottedTasks.slice(0, -1);

  // If no dotted tasks remain, reset scan to position 1 (first task is new implicit X)
  const newScanPosition = newDotted.length === 0 ? 1 : completedIndex + 1;

  return {
    fvp: {
      dottedTasks: newDotted,
      scanPosition: newScanPosition,
    },
  };
}

/**
 * Reset FVP entirely — start over.
 */
export function resetFVP(_tmsState: TMSState): Partial<TMSState> {
  return {
    fvp: {
      dottedTasks: [],
      scanPosition: 1,
    },
  };
}
