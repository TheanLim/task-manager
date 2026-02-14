import { Task, TMSState } from '@/types';

/**
 * Standard (No TMS) Handler — Pure Functions
 * 
 * This is the default handler when no time management system is active.
 * Tasks are simply ordered by their order field.
 */

/**
 * Initialize standard system — no initialization needed, returns empty delta
 */
export function initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * Get tasks ordered by their order field
 */
export function getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order);
}

/**
 * When a task is created — no special handling, returns empty delta
 */
export function onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * When a task is completed — no special handling, returns empty delta
 */
export function onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState> {
  return {};
}
