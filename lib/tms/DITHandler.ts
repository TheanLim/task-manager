import { Task, TimeManagementSystem } from '@/types';
import { TimeManagementSystemHandler } from './index';
import { useTMSStore } from '@/stores/tmsStore';

/**
 * Do It Tomorrow (DIT) Handler
 * 
 * DIT is a time management system where:
 * - New tasks go to "Tomorrow"
 * - Each day, tomorrow's tasks become today's tasks
 * - Focus on completing today's tasks
 */
export class DITHandler implements TimeManagementSystemHandler {
  name = TimeManagementSystem.DIT;
  
  /**
   * Initialize DIT system - check if day has changed and perform rollover if needed
   */
  initialize(tasks: Task[]): void {
    const state = useTMSStore.getState().state;
    const lastDayChange = state.dit.lastDayChange.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (lastDayChange !== today) {
      useTMSStore.getState().performDayRollover();
    }
  }
  
  /**
   * Get tasks ordered by DIT priority: today's tasks first, then tomorrow's tasks
   */
  getOrderedTasks(tasks: Task[]): Task[] {
    const state = useTMSStore.getState().state;
    const todayIds = new Set(state.dit.todayTasks);
    const tomorrowIds = new Set(state.dit.tomorrowTasks);
    
    const todayTasks = tasks.filter(t => todayIds.has(t.id));
    const tomorrowTasks = tasks.filter(t => tomorrowIds.has(t.id));
    const otherTasks = tasks.filter(t => !todayIds.has(t.id) && !tomorrowIds.has(t.id));
    
    return [...todayTasks, ...tomorrowTasks, ...otherTasks];
  }
  
  /**
   * When a task is created, add it to tomorrow's list
   */
  onTaskCreated(task: Task): void {
    useTMSStore.getState().addToTomorrow(task.id);
  }
  
  /**
   * When a task is completed, remove it from today's list
   */
  onTaskCompleted(task: Task): void {
    const state = useTMSStore.getState().state;
    
    // Remove from today's tasks if present
    if (state.dit.todayTasks.includes(task.id)) {
      const todayTasks = state.dit.todayTasks.filter(id => id !== task.id);
      useTMSStore.setState({
        state: {
          ...state,
          dit: { ...state.dit, todayTasks }
        }
      });
    }
    
    // Remove from tomorrow's tasks if present
    if (state.dit.tomorrowTasks.includes(task.id)) {
      const tomorrowTasks = state.dit.tomorrowTasks.filter(id => id !== task.id);
      useTMSStore.setState({
        state: {
          ...state,
          dit: { ...state.dit, tomorrowTasks }
        }
      });
    }
  }
  
  /**
   * Handle day change - perform rollover
   */
  onDayChange(): void {
    useTMSStore.getState().performDayRollover();
  }
}
