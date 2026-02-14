import { Task, TMSState } from '@/types';

/**
 * Final Version Perfected (FVP) Handler — Pure Functions
 * 
 * FVP is a time management system where:
 * - You scan through your task list and "dot" tasks you want to do before a reference task (X)
 * - Dotted tasks are shown in reverse order (last dotted first = most urgent)
 * - Work through dotted tasks in that order
 * - When a task is completed, it's removed from the dotted list
 */

/**
 * Initialize FVP system — no initialization needed, returns empty delta
 */
export function initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * Get tasks ordered by FVP priority: dotted tasks in reverse order (last dotted first), then undotted tasks
 */
export function getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[] {
  if (tmsState.fvp.dottedTasks.length === 0) {
    return tasks;
  }
  
  // Show dotted tasks in reverse order (last dotted first)
  const dottedIds = new Set(tmsState.fvp.dottedTasks);
  const dottedTasks = [...tmsState.fvp.dottedTasks]
    .reverse()
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as Task[];
  
  // Then show undotted tasks in their natural order
  const undottedTasks = tasks.filter(t => !dottedIds.has(t.id));
  
  return [...dottedTasks, ...undottedTasks];
}

/**
 * When a task is created — no special handling for FVP, returns empty delta
 */
export function onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState> {
  return {};
}

/**
 * When a task is completed, remove its dot if present and reset X if needed — returns state delta
 */
export function onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState> {
  if (tmsState.fvp.dottedTasks.includes(task.id)) {
    const dottedTasks = tmsState.fvp.dottedTasks.filter(id => id !== task.id);
    
    const updates: Partial<typeof tmsState.fvp> = { dottedTasks };
    if (tmsState.fvp.currentX === task.id) {
      updates.currentX = null;
      updates.selectionInProgress = false;
    }
    
    return {
      fvp: { ...tmsState.fvp, ...updates },
    };
  }
  
  return {};
}
