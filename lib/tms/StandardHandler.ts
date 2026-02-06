import { Task, TimeManagementSystem } from '@/types';
import { TimeManagementSystemHandler } from './index';

/**
 * Standard (No TMS) Handler
 * 
 * This is the default handler when no time management system is active.
 * Tasks are simply ordered by their order field.
 */
export class StandardHandler implements TimeManagementSystemHandler {
  name = TimeManagementSystem.NONE;
  
  /**
   * Initialize standard system - no initialization needed
   */
  initialize(tasks: Task[]): void {
    // No initialization needed
  }
  
  /**
   * Get tasks ordered by their order field
   */
  getOrderedTasks(tasks: Task[]): Task[] {
    // Return tasks sorted by order field
    return [...tasks].sort((a, b) => a.order - b.order);
  }
  
  /**
   * When a task is created, no special handling needed
   */
  onTaskCreated(task: Task): void {
    // No special handling
  }
  
  /**
   * When a task is completed, no special handling needed
   */
  onTaskCompleted(task: Task): void {
    // No special handling
  }
}
