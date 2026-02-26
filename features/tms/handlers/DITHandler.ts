import { z } from 'zod';
import { Task } from '@/types';
import { TimeManagementSystemHandler } from './index';
import { DITView } from '../components/DITView';

/**
 * Do It Tomorrow (DIT) Handler
 *
 * DIT is a time management system where:
 * - New tasks go to "Tomorrow"
 * - Each day, tomorrow's tasks become today's tasks (day rollover on activate)
 * - Focus on completing today's tasks
 *
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §8 "DIT Handler"
 */

// ── State schema ──────────────────────────────────────────────────────────────

const DITStateSchema = z.object({
  todayTasks:    z.array(z.string().min(1)),
  tomorrowTasks: z.array(z.string().min(1)),
  lastDayChange: z.string().datetime(),
});

export type DITState = z.infer<typeof DITStateSchema>;

// ── Action union ──────────────────────────────────────────────────────────────

export type DITAction =
  | { type: 'MOVE_TO_TODAY';        taskId: string }
  | { type: 'MOVE_TO_TOMORROW';     taskId: string }
  | { type: 'REMOVE_FROM_SCHEDULE'; taskId: string };

// ── Handler object ────────────────────────────────────────────────────────────

export const DITHandler: TimeManagementSystemHandler<DITState, DITAction> = {
  id: 'dit',
  displayName: 'DIT',
  description: 'Do It Tomorrow',
  stateSchema: DITStateSchema,
  stateVersion: 1,

  getInitialState() {
    return { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() };
  },

  validateState(raw) {
    const result = DITStateSchema.safeParse(raw);
    return result.success ? result.data : this.getInitialState();
  },

  migrateState(_fromVersion, raw) {
    return this.validateState(raw);
  },

  onActivate(_tasks, currentState) {
    const lastDay = currentState.lastDayChange.split('T')[0];
    const today   = new Date().toISOString().split('T')[0];
    if (lastDay !== today) {
      return {
        todayTasks:    [...currentState.tomorrowTasks],
        tomorrowTasks: [],
        lastDayChange: new Date().toISOString(),
      };
    }
    return {};
  },

  onDeactivate(_state) {
    return {};
  },

  getOrderedTasks(tasks, state) {
    const todaySet    = new Set(state.todayTasks);
    const tomorrowSet = new Set(state.tomorrowTasks);
    return [
      ...tasks.filter(t => todaySet.has(t.id)),
      ...tasks.filter(t => tomorrowSet.has(t.id) && !todaySet.has(t.id)),
      ...tasks.filter(t => !todaySet.has(t.id) && !tomorrowSet.has(t.id)),
    ];
  },

  onTaskCreated(task, state) {
    return { tomorrowTasks: [...state.tomorrowTasks, task.id] };
  },

  onTaskCompleted(task, state) {
    return {
      todayTasks:    state.todayTasks.filter(id => id !== task.id),
      tomorrowTasks: state.tomorrowTasks.filter(id => id !== task.id),
    };
  },

  onTaskDeleted(taskId, state) {
    return {
      todayTasks:    state.todayTasks.filter(id => id !== taskId),
      tomorrowTasks: state.tomorrowTasks.filter(id => id !== taskId),
    };
  },

  reduce(state, action) {
    switch (action.type) {
      case 'MOVE_TO_TODAY':
        return {
          todayTasks:    [...state.todayTasks.filter(x => x !== action.taskId), action.taskId],
          tomorrowTasks: state.tomorrowTasks.filter(x => x !== action.taskId),
        };
      case 'MOVE_TO_TOMORROW':
        return {
          tomorrowTasks: [...state.tomorrowTasks.filter(x => x !== action.taskId), action.taskId],
          todayTasks:    state.todayTasks.filter(x => x !== action.taskId),
        };
      case 'REMOVE_FROM_SCHEDULE':
        return {
          todayTasks:    state.todayTasks.filter(x => x !== action.taskId),
          tomorrowTasks: state.tomorrowTasks.filter(x => x !== action.taskId),
        };
    }
  },

  getViewComponent() {
    return DITView;
  },
};
