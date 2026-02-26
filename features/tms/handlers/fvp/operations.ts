/**
 * FVP operations — pure functions that return state deltas.
 */

import { Task } from '@/types';
import type { FVPState } from './types';

export function initialize(tasks: Task[], _fvpState: FVPState): Partial<FVPState> {
  const firstIncomplete = tasks.find(t => !t.completed);
  if (!firstIncomplete) {
    return { dottedTasks: [], scanPosition: 1 };
  }
  const incompleteList = tasks.filter(t => !t.completed);
  const firstIndex = incompleteList.findIndex(t => t.id === firstIncomplete.id);
  return { dottedTasks: [firstIncomplete.id], scanPosition: firstIndex + 1 };
}

export function onTaskCreated(_task: Task, _fvpState: FVPState): Partial<FVPState> {
  return {};
}

export function onTaskCompleted(task: Task, fvpState: FVPState): Partial<FVPState> {
  const { dottedTasks } = fvpState;
  if (!dottedTasks.includes(task.id)) return {};
  const newDotted = dottedTasks.filter(id => id !== task.id);
  return { dottedTasks: newDotted, scanPosition: fvpState.scanPosition };
}

export function dotTask(candidateTask: Task, tasks: Task[], fvpState: FVPState): Partial<FVPState> {
  const incomplete = tasks.filter(t => !t.completed);
  const candidateIndex = incomplete.findIndex(t => t.id === candidateTask.id);
  return { dottedTasks: [...fvpState.dottedTasks, candidateTask.id], scanPosition: candidateIndex + 1 };
}

export function skipTask(candidateTask: Task, tasks: Task[], fvpState: FVPState): Partial<FVPState> {
  const incomplete = tasks.filter(t => !t.completed);
  const candidateIndex = incomplete.findIndex(t => t.id === candidateTask.id);
  return { dottedTasks: fvpState.dottedTasks, scanPosition: candidateIndex + 1 };
}

export function completeCurrentTask(tasks: Task[], fvpState: FVPState): Partial<FVPState> {
  const { dottedTasks } = fvpState;
  if (dottedTasks.length === 0) return {};
  const currentTaskId = dottedTasks[dottedTasks.length - 1];
  const incompleteAtCallTime = tasks.filter(t => !t.completed || t.id === currentTaskId);
  const completedIndex = incompleteAtCallTime.findIndex(t => t.id === currentTaskId);
  const newDotted = dottedTasks.slice(0, -1);
  const newScanPosition = newDotted.length === 0 ? 1 : completedIndex + 1;
  return { dottedTasks: newDotted, scanPosition: newScanPosition };
}

export function onTaskDeleted(taskId: string, tasks: Task[], fvpState: FVPState): Partial<FVPState> {
  const { dottedTasks, scanPosition } = fvpState;
  if (!dottedTasks.includes(taskId)) return {};
  const newDotted = dottedTasks.filter(id => id !== taskId);
  const incomplete = tasks.filter(t => !t.completed);
  const deletedIndex = incomplete.findIndex(t => t.id === taskId);
  const shouldDecrement = deletedIndex !== -1 && deletedIndex < scanPosition && scanPosition < incomplete.length;
  const newScanPosition = shouldDecrement ? scanPosition - 1 : scanPosition;
  return { dottedTasks: newDotted, scanPosition: newScanPosition };
}

export function resetFVP(_fvpState: FVPState): Partial<FVPState> {
  return { dottedTasks: [], scanPosition: 1 };
}

/**
 * Re-enter the current task (last dotted) at the end of the list.
 * Removes it from dottedTasks (same as completeCurrentTask) but does NOT
 * mark it complete — the caller should NOT call onTaskComplete.
 * The task stays in the task list and will be picked up in future preselections.
 */
export function reenterCurrentTask(tasks: Task[], fvpState: FVPState): Partial<FVPState> {
  // Same state change as completeCurrentTask — remove from dotted chain,
  // set scanPosition after the task's position. The difference is the caller
  // does NOT mark the task complete in the global store.
  return completeCurrentTask(tasks, fvpState);
}
