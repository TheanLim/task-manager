import { Task, TMSState } from '@/types';

/**
 * Autofocus 4 (AF4) Handler — Pure Functions
 * 
 * AF4 is a time management system where:
 * - You mark tasks you want to work on
 * - Marked tasks are shown first in the order they were marked
 * - Work through marked tasks in order
 * - When a task is completed, it's unmarked
 */

/**
 * Initialize AF4 system — no initialization needed, returns empty delta
 */
export function initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * Get tasks ordered by AF4 priority: marked tasks first in marked order, then unmarked tasks
 */
export function getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[] {
  const markedIds = new Set(tmsState.af4.markedTasks);
  
  // Show marked tasks first in marked order
  const markedTasks = tmsState.af4.markedOrder
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as Task[];
  
  // Then show unmarked tasks in their natural order
  const unmarkedTasks = tasks.filter(t => !markedIds.has(t.id));
  
  return [...markedTasks, ...unmarkedTasks];
}

/**
 * When a task is created — no special handling for AF4, returns empty delta
 */
export function onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * When a task is completed, remove its mark if present — returns state delta
 */
export function onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState> {
  if (tmsState.af4.markedTasks.includes(task.id)) {
    return {
      af4: {
        markedTasks: tmsState.af4.markedTasks.filter(id => id !== task.id),
        markedOrder: tmsState.af4.markedOrder.filter(id => id !== task.id),
      },
    };
  }
  
  return {};
}
