import { TimeManagementSystemHandler } from '../index';
import { AF4View } from '../../components/AF4View';
import { AF4StateSchema } from './types';
import type { AF4State, AF4Action } from './types';
import { getOrderedTasks, onTaskCreated, onTaskCompleted, onTaskDeleted, madeProgress, markDone, dismissTask, resolveDismissed, advanceAfterFullPass } from './operations';

export type { AF4State, AF4Action } from './types';
export { AF4StateSchema } from './types';
export { getCurrentTask, isFullPassComplete, isBacklogEmpty } from './helpers';
export { initialize, getOrderedTasks, onTaskCreated, onTaskCompleted, madeProgress, markDone, skipTask, advanceAfterFullPass, dismissTask, resolveDismissed, onTaskDeleted } from './operations';

export const AF4Handler: TimeManagementSystemHandler<AF4State, AF4Action> = {
  id: 'af4',
  displayName: 'AF4',
  description: 'Autofocus 4',
  stateSchema: AF4StateSchema,
  stateVersion: 1,

  getInitialState() {
    return { backlogTaskIds: [], activeListTaskIds: [], currentPosition: 0, lastPassHadWork: false, dismissedTaskIds: [], phase: 'backlog' };
  },
  validateState(raw) {
    const result = AF4StateSchema.safeParse(raw);
    return result.success ? result.data : this.getInitialState();
  },
  migrateState(_fromVersion, raw) { return this.validateState(raw); },
  onActivate(tasks, currentState) {
    // If backlog is empty and no tasks are in any list, initialize with all incomplete tasks
    if (currentState.backlogTaskIds.length === 0 && currentState.activeListTaskIds.length === 0) {
      const incompleteTasks = tasks.filter(t => !t.completed);
      if (incompleteTasks.length > 0) {
        return {
          backlogTaskIds: incompleteTasks.map(t => t.id),
          activeListTaskIds: [],
          currentPosition: 0,
          lastPassHadWork: false,
          dismissedTaskIds: [],
          phase: 'backlog' as const,
        };
      }
    }
    return {};
  },
  onDeactivate(_state) { return {}; },
  getOrderedTasks(tasks, state) { return getOrderedTasks(tasks, state); },
  onTaskCreated(task, state) { return onTaskCreated(task, state); },
  onTaskCompleted(task, state) { return onTaskCompleted(task, state); },
  onTaskDeleted(taskId, state) { return onTaskDeleted(taskId, state); },

  reduce(state, action) {
    switch (action.type) {
      case 'MADE_PROGRESS': return madeProgress([], state);
      case 'MARK_DONE': return markDone([], state);
      case 'SKIP_TASK': return { currentPosition: state.currentPosition + 1 };
      case 'FLAG_DISMISSED': {
        const list = state.phase === 'backlog' ? state.backlogTaskIds : state.activeListTaskIds;
        const taskId = list[state.currentPosition];
        if (!taskId) return {};
        return dismissTask(taskId, state);
      }
      case 'RESOLVE_DISMISSED': return resolveDismissed(action.taskId, action.resolution, state);
      case 'ADVANCE_AFTER_FULL_PASS': return advanceAfterFullPass(action.tasks, state);
      case 'PROMOTE_ACTIVE_LIST': return { backlogTaskIds: state.activeListTaskIds, activeListTaskIds: [], currentPosition: 0, phase: 'backlog' as const };
    }
  },
  getViewComponent() { return AF4View; },
};
