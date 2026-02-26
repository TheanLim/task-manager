/**
 * FVP Handler — barrel export.
 *
 * Re-exports types, helpers, operations, and the handler object.
 */

import { TimeManagementSystemHandler } from '../index';
import { FVPView } from '../../components/FVPView';
import { FVPStateSchema } from './types';
import type { FVPState, FVPAction } from './types';
import { getOrderedTasks } from './helpers';
import {
  initialize, onTaskCompleted, dotTask, skipTask,
  completeCurrentTask, reenterCurrentTask, resetFVP,
} from './operations';

// Re-export everything consumers need
export type { FVPState, FVPAction } from './types';
export { FVPStateSchema } from './types';
export {
  getCurrentTask, getCurrentX, getScanCandidate,
  isPreselectionComplete, getOrderedTasks,
} from './helpers';
export {
  initialize, onTaskCreated, onTaskCompleted,
  dotTask, skipTask, completeCurrentTask,
  reenterCurrentTask, onTaskDeleted, resetFVP,
} from './operations';

// ── Handler object ────────────────────────────────────────────────────────────

export const FVPHandler: TimeManagementSystemHandler<FVPState, FVPAction> = {
  id: 'fvp',
  displayName: 'FVP',
  description: 'Final Version Perfected',
  stateSchema: FVPStateSchema,
  stateVersion: 1,

  getInitialState() {
    return { dottedTasks: [], scanPosition: 1 };
  },

  validateState(raw) {
    const result = FVPStateSchema.safeParse(raw);
    return result.success ? result.data : this.getInitialState();
  },

  migrateState(_fromVersion, raw) {
    return this.validateState(raw);
  },

  onActivate(_tasks, _state) { return {}; },
  onDeactivate(_state) { return {}; },

  getOrderedTasks(tasks, state) {
    return getOrderedTasks(tasks, state);
  },

  onTaskCreated(_task, _state) { return {}; },

  onTaskCompleted(task, state) {
    return onTaskCompleted(task, state);
  },

  onTaskDeleted(taskId, state) {
    if (!state.dottedTasks.includes(taskId)) return {};
    return { dottedTasks: state.dottedTasks.filter(id => id !== taskId) };
  },

  reduce(state, action) {
    switch (action.type) {
      case 'START_PRESELECTION': return initialize([], state);
      case 'DOT_TASK': return dotTask(action.task, action.tasks, state);
      case 'SKIP_CANDIDATE': return skipTask(action.task, action.tasks, state);
      case 'COMPLETE_CURRENT': return completeCurrentTask(action.tasks, state);
      case 'REENTER_CURRENT': return reenterCurrentTask(action.tasks, state);
      case 'RESET_FVP': return resetFVP(state);
    }
  },

  getViewComponent() { return FVPView; },
};
