/**
 * FVP derived helpers — pure functions exported for UI use.
 */

import { Task } from '@/types';
import type { FVPState } from './types';

/** The task the user should do right now (last dotted). */
export function getCurrentTask(tasks: Task[], fvpState: FVPState): Task | null {
  const { dottedTasks } = fvpState;
  if (dottedTasks.length === 0) return null;
  const id = dottedTasks[dottedTasks.length - 1];
  return tasks.find(t => t.id === id) ?? null;
}

/** The reference task X (last dotted = current benchmark, or first undotted if nothing dotted yet). */
export function getCurrentX(tasks: Task[], fvpState: FVPState): Task | null {
  const { dottedTasks } = fvpState;
  if (dottedTasks.length >= 1) {
    const id = dottedTasks[dottedTasks.length - 1];
    return tasks.find(t => t.id === id) ?? null;
  }
  return tasks.find(t => !t.completed) ?? null;
}

/** The next candidate task to compare against X during preselection. */
export function getScanCandidate(tasks: Task[], fvpState: FVPState): Task | null {
  const { scanPosition, dottedTasks } = fvpState;
  const dottedSet = new Set(dottedTasks);
  const incomplete = tasks.filter(t => !t.completed);
  for (let i = scanPosition; i < incomplete.length; i++) {
    if (!dottedSet.has(incomplete[i].id)) {
      return incomplete[i];
    }
  }
  return null;
}

/** True when there are no more candidates to scan. */
export function isPreselectionComplete(tasks: Task[], fvpState: FVPState): boolean {
  return getScanCandidate(tasks, fvpState) === null;
}

/** Order for display: dotted first, then undotted incomplete, then completed. */
export function getOrderedTasks(tasks: Task[], fvpState: FVPState): Task[] {
  const dottedSet = new Set(fvpState.dottedTasks);
  const dottedTasks = fvpState.dottedTasks
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const undotted = tasks.filter(t => !dottedSet.has(t.id) && !t.completed);
  const completed = tasks.filter(t => !dottedSet.has(t.id) && t.completed);
  return [...dottedTasks, ...undotted, ...completed];
}
