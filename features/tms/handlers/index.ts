import { Task, TMSState, TimeManagementSystem } from '@/types';
import * as DITHandler from './DITHandler';
import * as AF4Handler from './AF4Handler';
import * as FVPHandler from './FVPHandler';
import * as StandardHandler from './StandardHandler';

/**
 * Interface for Time Management System handlers.
 * Each handler is a set of pure functions that accept state and return results/deltas.
 * No store access — call sites read state, pass it in, and apply returned updates.
 */
export interface TimeManagementSystemHandler {
  /** The name/type of this TMS */
  name: TimeManagementSystem;

  /** Initialize system state when activated — returns state delta */
  initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState>;

  /** Get tasks in the order they should be displayed for this TMS */
  getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[];

  /** Handle task creation lifecycle event — returns state delta */
  onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState>;

  /** Handle task completion lifecycle event — returns state delta */
  onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState>;
}

/**
 * Factory function to get the appropriate TMS handler.
 * Returns a handler object wrapping pure functions — no store dependencies.
 */
export function getTMSHandler(system: TimeManagementSystem): TimeManagementSystemHandler {
  switch (system) {
    case TimeManagementSystem.DIT:
      return {
        name: TimeManagementSystem.DIT,
        initialize: DITHandler.initialize,
        getOrderedTasks: DITHandler.getOrderedTasks,
        onTaskCreated: DITHandler.onTaskCreated,
        onTaskCompleted: DITHandler.onTaskCompleted,
      };
    case TimeManagementSystem.AF4:
      return {
        name: TimeManagementSystem.AF4,
        initialize: AF4Handler.initialize,
        getOrderedTasks: AF4Handler.getOrderedTasks,
        onTaskCreated: AF4Handler.onTaskCreated,
        onTaskCompleted: AF4Handler.onTaskCompleted,
      };
    case TimeManagementSystem.FVP:
      return {
        name: TimeManagementSystem.FVP,
        initialize: FVPHandler.initialize,
        getOrderedTasks: FVPHandler.getOrderedTasks,
        onTaskCreated: FVPHandler.onTaskCreated,
        onTaskCompleted: FVPHandler.onTaskCompleted,
      };
    case TimeManagementSystem.NONE:
      return {
        name: TimeManagementSystem.NONE,
        initialize: StandardHandler.initialize,
        getOrderedTasks: StandardHandler.getOrderedTasks,
        onTaskCreated: StandardHandler.onTaskCreated,
        onTaskCompleted: StandardHandler.onTaskCompleted,
      };
    default:
      throw new Error(`Unknown time management system: ${system}`);
  }
}
