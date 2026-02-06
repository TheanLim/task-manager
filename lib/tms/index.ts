import { Task, TimeManagementSystem, UUID } from '@/types';
import { DITHandler } from './DITHandler';
import { AF4Handler } from './AF4Handler';
import { FVPHandler } from './FVPHandler';
import { StandardHandler } from './StandardHandler';

/**
 * Interface for Time Management System handlers
 * Each TMS implements this interface to provide custom task ordering and lifecycle hooks
 */
export interface TimeManagementSystemHandler {
  /** The name/type of this TMS */
  name: TimeManagementSystem;
  
  /** Initialize system state when activated */
  initialize(tasks: Task[]): void;
  
  /** Get tasks in the order they should be displayed for this TMS */
  getOrderedTasks(tasks: Task[]): Task[];
  
  /** Handle task creation lifecycle event */
  onTaskCreated(task: Task): void;
  
  /** Handle task completion lifecycle event */
  onTaskCompleted(task: Task): void;
  
  /** Handle day change (optional, primarily for DIT) */
  onDayChange?(): void;
}

/**
 * Factory function to get the appropriate TMS handler
 * @param system - The time management system to get a handler for
 * @returns The handler instance for the specified system
 */
export function getTMSHandler(system: TimeManagementSystem): TimeManagementSystemHandler {
  switch (system) {
    case TimeManagementSystem.DIT:
      return new DITHandler();
    case TimeManagementSystem.AF4:
      return new AF4Handler();
    case TimeManagementSystem.FVP:
      return new FVPHandler();
    case TimeManagementSystem.NONE:
      return new StandardHandler();
    default:
      throw new Error(`Unknown time management system: ${system}`);
  }
}
