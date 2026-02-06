import { Task, TimeManagementSystem } from '@/types';
import { TimeManagementSystemHandler } from './index';
import { useTMSStore } from '@/stores/tmsStore';

/**
 * Final Version Perfected (FVP) Handler
 * 
 * FVP is a time management system where:
 * - You scan through your task list and "dot" tasks you want to do before a reference task (X)
 * - Dotted tasks are shown in reverse order (last dotted first = most urgent)
 * - Work through dotted tasks in that order
 * - When a task is completed, it's removed from the dotted list
 */
export class FVPHandler implements TimeManagementSystemHandler {
  name = TimeManagementSystem.FVP;
  
  /**
   * Initialize FVP system - no initialization needed
   */
  initialize(tasks: Task[]): void {
    // No initialization needed for FVP
  }
  
  /**
   * Get tasks ordered by FVP priority: dotted tasks in reverse order (last dotted first), then undotted tasks
   */
  getOrderedTasks(tasks: Task[]): Task[] {
    const state = useTMSStore.getState().state;
    
    if (state.fvp.dottedTasks.length === 0) {
      return tasks;
    }
    
    // Show dotted tasks in reverse order (last dotted first)
    const dottedIds = new Set(state.fvp.dottedTasks);
    const dottedTasks = [...state.fvp.dottedTasks]
      .reverse()
      .map(id => tasks.find(t => t.id === id))
      .filter(Boolean) as Task[];
    
    // Then show undotted tasks in their natural order
    const undottedTasks = tasks.filter(t => !dottedIds.has(t.id));
    
    return [...dottedTasks, ...undottedTasks];
  }
  
  /**
   * When a task is created, no special handling needed
   */
  onTaskCreated(task: Task): void {
    // No special handling for FVP
  }
  
  /**
   * When a task is completed, remove its dot if present and reset X if needed
   */
  onTaskCompleted(task: Task): void {
    const state = useTMSStore.getState().state;
    
    // Remove dot if present
    if (state.fvp.dottedTasks.includes(task.id)) {
      const dottedTasks = state.fvp.dottedTasks.filter(id => id !== task.id);
      
      // Reset current X if it was the completed task
      const updates: Partial<typeof state.fvp> = { dottedTasks };
      if (state.fvp.currentX === task.id) {
        updates.currentX = null;
        updates.selectionInProgress = false;
      }
      
      useTMSStore.setState({
        state: {
          ...state,
          fvp: { ...state.fvp, ...updates }
        }
      });
    }
  }
}
