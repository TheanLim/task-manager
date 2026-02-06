import { Task, TimeManagementSystem } from '@/types';
import { TimeManagementSystemHandler } from './index';
import { useTMSStore } from '@/stores/tmsStore';

/**
 * Autofocus 4 (AF4) Handler
 * 
 * AF4 is a time management system where:
 * - You mark tasks you want to work on
 * - Marked tasks are shown first in the order they were marked
 * - Work through marked tasks in order
 * - When a task is completed, it's unmarked
 */
export class AF4Handler implements TimeManagementSystemHandler {
  name = TimeManagementSystem.AF4;
  
  /**
   * Initialize AF4 system - no initialization needed
   */
  initialize(tasks: Task[]): void {
    // No initialization needed for AF4
  }
  
  /**
   * Get tasks ordered by AF4 priority: marked tasks first in marked order, then unmarked tasks
   */
  getOrderedTasks(tasks: Task[]): Task[] {
    const state = useTMSStore.getState().state;
    const markedIds = new Set(state.af4.markedTasks);
    
    // Show marked tasks first in marked order
    const markedTasks = state.af4.markedOrder
      .map(id => tasks.find(t => t.id === id))
      .filter(Boolean) as Task[];
    
    // Then show unmarked tasks in their natural order
    const unmarkedTasks = tasks.filter(t => !markedIds.has(t.id));
    
    return [...markedTasks, ...unmarkedTasks];
  }
  
  /**
   * When a task is created, no special handling needed
   */
  onTaskCreated(task: Task): void {
    // No special handling for AF4
  }
  
  /**
   * When a task is completed, remove its mark if present
   */
  onTaskCompleted(task: Task): void {
    const state = useTMSStore.getState().state;
    
    // Remove mark if present
    if (state.af4.markedTasks.includes(task.id)) {
      useTMSStore.getState().unmarkTask(task.id);
    }
  }
}
