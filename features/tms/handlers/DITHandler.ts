import { Task, TMSState } from '@/types';

/**
 * Do It Tomorrow (DIT) Handler — Pure Functions
 * 
 * DIT is a time management system where:
 * - New tasks go to "Tomorrow"
 * - Each day, tomorrow's tasks become today's tasks
 * - Focus on completing today's tasks
 */

/**
 * Initialize DIT system - check if day has changed and return rollover state delta if needed
 */
export function initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState> {
  const lastDayChange = tmsState.dit.lastDayChange.split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  if (lastDayChange !== today) {
    return {
      dit: {
        todayTasks: [...tmsState.dit.tomorrowTasks],
        tomorrowTasks: [],
        lastDayChange: new Date().toISOString(),
      },
    };
  }
  
  return {};
}

/**
 * Get tasks ordered by DIT priority: today's tasks first, then tomorrow's tasks, then others
 */
export function getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[] {
  const todayIds = new Set(tmsState.dit.todayTasks);
  const tomorrowIds = new Set(tmsState.dit.tomorrowTasks);
  
  const todayTasks = tasks.filter(t => todayIds.has(t.id));
  const tomorrowTasks = tasks.filter(t => tomorrowIds.has(t.id));
  const otherTasks = tasks.filter(t => !todayIds.has(t.id) && !tomorrowIds.has(t.id));
  
  return [...todayTasks, ...tomorrowTasks, ...otherTasks];
}

/**
 * When a task is created, add it to tomorrow's list — returns state delta
 */
export function onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState> {
  return {
    dit: {
      ...tmsState.dit,
      tomorrowTasks: [...tmsState.dit.tomorrowTasks, task.id],
    },
  };
}

/**
 * When a task is completed, remove it from today's and tomorrow's lists — returns state delta
 */
export function onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState> {
  const todayTasks = tmsState.dit.todayTasks.filter(id => id !== task.id);
  const tomorrowTasks = tmsState.dit.tomorrowTasks.filter(id => id !== task.id);
  
  return {
    dit: {
      ...tmsState.dit,
      todayTasks,
      tomorrowTasks,
    },
  };
}
