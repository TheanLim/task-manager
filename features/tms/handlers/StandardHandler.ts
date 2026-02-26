import { z } from 'zod';
import { TimeManagementSystemHandler } from './index';
import { StandardView } from '../components/StandardView';

/**
 * Standard (Review Queue) Handler
 *
 * Minimal state — the host applies needsAttentionSort ordering.
 * getOrderedTasks returns tasks in the order provided.
 * getViewComponent will be wired to StandardView in task 4.9.
 *
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §8 "StandardHandler"
 */

const StandardStateSchema = z.object({});
type StandardState = z.infer<typeof StandardStateSchema>;
type StandardAction = never;

export const StandardHandler: TimeManagementSystemHandler<StandardState, StandardAction> = {
  id: 'none',
  displayName: 'Review Queue',
  description: 'Standard mode',
  stateSchema: StandardStateSchema,
  stateVersion: 1,

  getInitialState: () => ({}),
  validateState(_raw) { return {}; },
  migrateState(_v, _raw) { return {}; },

  onActivate(_tasks, _state) { return {}; },
  onDeactivate(_state) { return {}; },

  getOrderedTasks(tasks, _state) { return tasks; },

  onTaskCreated(_task, _state) { return {}; },
  onTaskCompleted(_task, _state) { return {}; },
  onTaskDeleted(_taskId, _state) { return {}; },

  reduce(_state, _action) { return {}; },

  getViewComponent() {
    return StandardView;
  },
};
