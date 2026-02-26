import { describe, it, expect } from 'vitest';
import * as AF4 from './index';
import type { AF4State } from './index';
import { Task, Priority } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeState = (overrides?: Partial<AF4State>): AF4State => ({
  backlogTaskIds: [],
  activeListTaskIds: [],
  currentPosition: 0,
  lastPassHadWork: false,
  dismissedTaskIds: [],
  phase: 'backlog',
  ...overrides,
});

const makeTask = (id: string, completed = false): Task => ({
  id,
  projectId: 'p1',
  parentTaskId: null,
  sectionId: null,
  description: `Task ${id}`,
  notes: '',
  assignee: '',
  priority: Priority.NONE,
  tags: [],
  dueDate: null,
  completed,
  completedAt: null,
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ─── initialize ──────────────────────────────────────────────────────────────

describe('AF4Handler.initialize', () => {
  it('puts all incomplete tasks into backlog, active list is empty', () => {
    const tasks = [makeTask('t1'), makeTask('t2'), makeTask('t3', true)];
    const delta = AF4.initialize(tasks, makeState());
    expect(delta.backlogTaskIds).toEqual(['t1', 't2']);
    expect(delta.activeListTaskIds).toEqual([]);
    expect(delta.currentPosition).toBe(0);
    expect(delta.phase).toBe('backlog');
  });

  it('handles empty task list', () => {
    const delta = AF4.initialize([], makeState());
    expect(delta.backlogTaskIds).toEqual([]);
  });
});

// ─── getOrderedTasks ─────────────────────────────────────────────────────────

describe('AF4Handler.getOrderedTasks', () => {
  it('returns backlog first, then active list, then unlisted tasks', () => {
    const [t1, t2, t3, t4] = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t2', 't1'],
      activeListTaskIds: ['t3'],
    });
    const ordered = AF4.getOrderedTasks([t1, t2, t3, t4], state);
    expect(ordered.map(t => t.id)).toEqual(['t2', 't1', 't3', 't4']);
  });

  it('skips IDs that no longer exist in the task list', () => {
    const t1 = makeTask('t1');
    const state = makeState({ backlogTaskIds: ['t1', 'ghost'] });
    const ordered = AF4.getOrderedTasks([t1], state);
    expect(ordered.map(t => t.id)).toEqual(['t1']);
  });
});

// ─── onTaskCreated ────────────────────────────────────────────────────────────

describe('AF4Handler.onTaskCreated', () => {
  it('appends new task to end of active list', () => {
    const state = makeState({ activeListTaskIds: ['t1'] });
    const delta = AF4.onTaskCreated(makeTask('t2'), state);
    expect(delta.activeListTaskIds).toEqual(['t1', 't2']);
  });

  it('does not touch backlog', () => {
    const state = makeState({ backlogTaskIds: ['t1'] });
    const delta = AF4.onTaskCreated(makeTask('t2'), state);
    expect(delta.backlogTaskIds).toEqual(['t1']);
  });
});

// ─── onTaskCompleted ─────────────────────────────────────────────────────────

describe('AF4Handler.onTaskCompleted', () => {
  it('removes task from backlog', () => {
    const state = makeState({ backlogTaskIds: ['t1', 't2', 't3'] });
    const delta = AF4.onTaskCompleted(makeTask('t2'), state);
    expect(delta.backlogTaskIds).toEqual(['t1', 't3']);
  });

  it('removes task from active list', () => {
    const state = makeState({ activeListTaskIds: ['t1', 't2'] });
    const delta = AF4.onTaskCompleted(makeTask('t1'), state);
    expect(delta.activeListTaskIds).toEqual(['t2']);
  });

  it('decrements currentPosition when completed task was before cursor', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2', 't3'],
      currentPosition: 2,
    });
    const delta = AF4.onTaskCompleted(makeTask('t1'), state);
    expect(delta.currentPosition).toBe(1);
  });

  it('does not change currentPosition when completed task is at or after cursor', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2', 't3'],
      currentPosition: 1,
    });
    const delta = AF4.onTaskCompleted(makeTask('t2'), state);
    expect(delta.currentPosition).toBe(1);
  });

  it('returns empty delta for task not in either list', () => {
    const state = makeState({ backlogTaskIds: ['t1'] });
    expect(AF4.onTaskCompleted(makeTask('t99'), state)).toEqual({});
  });
});

// ─── getCurrentTask ───────────────────────────────────────────────────────────

describe('AF4.getCurrentTask', () => {
  it('returns task at currentPosition in backlog phase', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ backlogTaskIds: ['t1', 't2', 't3'], currentPosition: 1 });
    expect(AF4.getCurrentTask(tasks, state)?.id).toBe('t2');
  });

  it('returns task at currentPosition in active phase', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({
      activeListTaskIds: ['t1', 't2'],
      currentPosition: 0,
      phase: 'active',
    });
    expect(AF4.getCurrentTask(tasks, state)?.id).toBe('t1');
  });

  it('returns null when list is empty', () => {
    expect(AF4.getCurrentTask([], makeState())).toBeNull();
  });

  it('returns null when currentPosition is past end of list', () => {
    const tasks = ['t1'].map(id => makeTask(id));
    const state = makeState({ backlogTaskIds: ['t1'], currentPosition: 5 });
    expect(AF4.getCurrentTask(tasks, state)).toBeNull();
  });
});

// ─── MADE_PROGRESS ───────────────────────────────────────────────────────────

describe('AF4.madeProgress', () => {
  it('MADE_PROGRESS removes task from backlog and appends to Active List end', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1', 't2', 't3'],
      activeListTaskIds: [],
      currentPosition: 1,
    });
    const delta = AF4.madeProgress(tasks, state);
    expect(delta.backlogTaskIds).toEqual(['t1', 't3']);
    expect(delta.activeListTaskIds).toEqual(['t2']);
  });

  it('MADE_PROGRESS does NOT mark task.completed = true', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      currentPosition: 0,
    });
    const delta = AF4.madeProgress(tasks, state);
    expect(delta.activeListTaskIds).toContain('t1');
    expect(delta.backlogTaskIds).not.toContain('t1');
  });

  it('MADE_PROGRESS sets lastPassHadWork to true', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      currentPosition: 0,
      lastPassHadWork: false,
    });
    const delta = AF4.madeProgress(tasks, state);
    expect(delta.lastPassHadWork).toBe(true);
  });
});

// ─── MARK_DONE ────────────────────────────────────────────────────────────────

describe('AF4.markDone', () => {
  it('MARK_DONE marks task complete and removes from all lists', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1', 't2', 't3'],
      activeListTaskIds: [],
      currentPosition: 1,
    });
    const delta = AF4.markDone(tasks, state);
    expect(delta.backlogTaskIds).not.toContain('t2');
    expect(delta.activeListTaskIds).not.toContain('t2');
  });
});

// ─── skipTask ────────────────────────────────────────────────────────────────

describe('AF4.skipTask', () => {
  it('increments currentPosition by 1', () => {
    const state = makeState({ currentPosition: 2 });
    const delta = AF4.skipTask(state);
    expect(delta.currentPosition).toBe(3);
  });
});

// ─── isFullPassComplete ───────────────────────────────────────────────────────

describe('AF4.isFullPassComplete', () => {
  it('returns true when currentPosition >= list length', () => {
    const state = makeState({ backlogTaskIds: ['t1', 't2'], currentPosition: 2 });
    expect(AF4.isFullPassComplete(state)).toBe(true);
  });

  it('returns false when still within the list', () => {
    const state = makeState({ backlogTaskIds: ['t1', 't2'], currentPosition: 1 });
    expect(AF4.isFullPassComplete(state)).toBe(false);
  });
});

// ─── advanceAfterFullPass ─────────────────────────────────────────────────────

describe('AF4.advanceAfterFullPass', () => {
  it('switches to active phase when backlog pass had no work', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      lastPassHadWork: false,
      phase: 'backlog',
    });
    const delta = AF4.advanceAfterFullPass(tasks, state);
    expect(delta.phase).toBe('active');
    expect(delta.currentPosition).toBe(0);
  });

  it('restarts backlog from 0 when backlog pass had work', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      lastPassHadWork: true,
      phase: 'backlog',
    });
    const delta = AF4.advanceAfterFullPass(tasks, state);
    expect(delta.phase).toBe('backlog');
    expect(delta.currentPosition).toBe(0);
    expect(delta.lastPassHadWork).toBe(false);
  });

  it('returns to backlog after active pass completes', () => {
    const tasks = ['t1'].map(id => makeTask(id));
    const state = makeState({
      backlogTaskIds: ['t1'],
      activeListTaskIds: [],
      phase: 'active',
      lastPassHadWork: false,
    });
    const delta = AF4.advanceAfterFullPass(tasks, state);
    expect(delta.phase).toBe('backlog');
  });

  it('promotes active list to new backlog when all backlog tasks are done', () => {
    const t1 = makeTask('t1', true);
    const t2 = makeTask('t2');
    const state = makeState({
      backlogTaskIds: ['t1'],
      activeListTaskIds: ['t2'],
      phase: 'backlog',
    });
    const delta = AF4.advanceAfterFullPass([t1, t2], state);
    expect(delta.backlogTaskIds).toEqual(['t2']);
    expect(delta.activeListTaskIds).toEqual([]);
    expect(delta.phase).toBe('backlog');
  });
});

// ─── dismissTask / resolveDismissed ───────────────────────────────────────────

describe('AF4.dismissTask', () => {
  it('adds task to dismissedTaskIds', () => {
    const state = makeState({ backlogTaskIds: ['t1'] });
    const delta = AF4.dismissTask('t1', state);
    expect(delta.dismissedTaskIds).toContain('t1');
  });

  it('is idempotent', () => {
    const state = makeState({ dismissedTaskIds: ['t1'] });
    expect(AF4.dismissTask('t1', state)).toEqual({});
  });
});

describe('AF4.resolveDismissed', () => {
  it('abandon removes task from all lists', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      dismissedTaskIds: ['t1'],
    });
    const delta = AF4.resolveDismissed('t1', 'abandon', state);
    expect(delta.backlogTaskIds).not.toContain('t1');
    expect(delta.dismissedTaskIds).not.toContain('t1');
  });

  it('re-enter moves task from backlog to end of active list', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      activeListTaskIds: ['t3'],
      dismissedTaskIds: ['t1'],
    });
    const delta = AF4.resolveDismissed('t1', 're-enter', state);
    expect(delta.backlogTaskIds).not.toContain('t1');
    expect(delta.activeListTaskIds).toEqual(['t3', 't1']);
    expect(delta.dismissedTaskIds).not.toContain('t1');
  });

  it('defer removes from dismissed but keeps in backlog', () => {
    const state = makeState({
      backlogTaskIds: ['t1'],
      dismissedTaskIds: ['t1'],
    });
    const delta = AF4.resolveDismissed('t1', 'defer', state);
    expect(delta.dismissedTaskIds).not.toContain('t1');
    expect(delta.backlogTaskIds).toEqual(['t1']);
  });
});

// ─── onTaskDeleted ────────────────────────────────────────────────────────────

describe('AF4.onTaskDeleted', () => {
  it('removes taskId from backlogTaskIds', () => {
    const state = makeState({ backlogTaskIds: ['t1', 't2', 't3'] });
    const delta = AF4.onTaskDeleted('t2', state);
    expect(delta.backlogTaskIds).toEqual(['t1', 't3']);
  });

  it('removes taskId from activeListTaskIds', () => {
    const state = makeState({ activeListTaskIds: ['t1', 't2', 't3'] });
    const delta = AF4.onTaskDeleted('t2', state);
    expect(delta.activeListTaskIds).toEqual(['t1', 't3']);
  });

  it('removes taskId from dismissedTaskIds', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2'],
      dismissedTaskIds: ['t2'],
    });
    const delta = AF4.onTaskDeleted('t2', state);
    expect(delta.dismissedTaskIds).not.toContain('t2');
  });

  it('decrements currentPosition when deleted task was before cursor in current phase list', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2', 't3'],
      currentPosition: 2,
      phase: 'backlog',
    });
    const delta = AF4.onTaskDeleted('t1', state);
    expect(delta.currentPosition).toBe(1);
  });

  it('does not change currentPosition when deleted task was at or after cursor', () => {
    const state = makeState({
      backlogTaskIds: ['t1', 't2', 't3'],
      currentPosition: 1,
      phase: 'backlog',
    });
    const delta = AF4.onTaskDeleted('t2', state);
    expect(delta.currentPosition).toBe(1);
  });

  it('clamps currentPosition to 0 (never negative)', () => {
    const state = makeState({
      backlogTaskIds: ['t1'],
      currentPosition: 0,
      phase: 'backlog',
    });
    const delta = AF4.onTaskDeleted('t1', state);
    expect(delta.currentPosition).toBeGreaterThanOrEqual(0);
  });

  it('returns empty delta when taskId not in any list', () => {
    const state = makeState({ backlogTaskIds: ['t1', 't2'] });
    expect(AF4.onTaskDeleted('t99', state)).toEqual({});
  });

  it('uses the active list for cursor adjustment when phase is active', () => {
    const state = makeState({
      activeListTaskIds: ['t1', 't2', 't3'],
      currentPosition: 2,
      phase: 'active',
    });
    const delta = AF4.onTaskDeleted('t1', state);
    expect(delta.currentPosition).toBe(1);
  });
});

// ─── AF4Handler (handler object interface) ────────────────────────────────────
// These tests cover the handler OBJECT (task 3.8). They MUST FAIL before 3.8.

import { AF4Handler } from './index';

describe('AF4Handler (handler object interface)', () => {
  describe('reduce', () => {
    describe('MADE_PROGRESS', () => {
      it('removes task from backlog and appends to Active List end', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2', 't3'],
          activeListTaskIds: [],
          currentPosition: 1,
        });
        const delta = AF4Handler.reduce(state, { type: 'MADE_PROGRESS' });
        expect(delta.backlogTaskIds).toEqual(['t1', 't3']);
        expect(delta.activeListTaskIds).toEqual(['t2']);
      });

      it('does NOT mark task complete', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          activeListTaskIds: [],
          currentPosition: 0,
        });
        const delta = AF4Handler.reduce(state, { type: 'MADE_PROGRESS' });
        // task stays in active list (not removed from all lists)
        expect(delta.activeListTaskIds).toContain('t1');
        expect(delta.backlogTaskIds).not.toContain('t1');
      });

      it('sets lastPassHadWork to true', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          currentPosition: 0,
          lastPassHadWork: false,
        });
        const delta = AF4Handler.reduce(state, { type: 'MADE_PROGRESS' });
        expect(delta.lastPassHadWork).toBe(true);
      });

      it('currentPosition stays the same (points to next task)', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2', 't3'],
          currentPosition: 1,
        });
        const delta = AF4Handler.reduce(state, { type: 'MADE_PROGRESS' });
        expect(delta.currentPosition).toBe(1);
      });
    });

    describe('MARK_DONE', () => {
      it('removes task from all lists', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2', 't3'],
          activeListTaskIds: [],
          currentPosition: 1,
        });
        const delta = AF4Handler.reduce(state, { type: 'MARK_DONE' });
        expect(delta.backlogTaskIds).not.toContain('t2');
        expect(delta.activeListTaskIds).not.toContain('t2');
      });

      it('currentPosition stays the same', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2', 't3'],
          currentPosition: 1,
        });
        const delta = AF4Handler.reduce(state, { type: 'MARK_DONE' });
        expect(delta.currentPosition).toBe(1);
      });
    });

    describe('SKIP_TASK', () => {
      it('increments currentPosition by 1', () => {
        const state = makeState({ currentPosition: 2 });
        const delta = AF4Handler.reduce(state, { type: 'SKIP_TASK' });
        expect(delta.currentPosition).toBe(3);
      });

      it('does not modify backlog or active list', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          activeListTaskIds: ['t3'],
          currentPosition: 0,
        });
        const delta = AF4Handler.reduce(state, { type: 'SKIP_TASK' });
        expect(delta.backlogTaskIds).toBeUndefined();
        expect(delta.activeListTaskIds).toBeUndefined();
      });
    });

    describe('ADVANCE_AFTER_FULL_PASS', () => {
      it('switches to active phase when backlog pass had no work', () => {
        const tasks = ['t1', 't2'].map(id => makeTask(id));
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          lastPassHadWork: false,
          phase: 'backlog',
        });
        const delta = AF4Handler.reduce(state, { type: 'ADVANCE_AFTER_FULL_PASS', tasks });
        expect(delta.phase).toBe('active');
        expect(delta.currentPosition).toBe(0);
      });

      it('restarts backlog from 0 when backlog pass had work', () => {
        const tasks = ['t1', 't2'].map(id => makeTask(id));
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          lastPassHadWork: true,
          phase: 'backlog',
        });
        const delta = AF4Handler.reduce(state, { type: 'ADVANCE_AFTER_FULL_PASS', tasks });
        expect(delta.phase).toBe('backlog');
        expect(delta.currentPosition).toBe(0);
        expect(delta.lastPassHadWork).toBe(false);
      });

      it('returns to backlog after active pass completes', () => {
        const tasks = ['t1'].map(id => makeTask(id));
        const state = makeState({
          backlogTaskIds: ['t1'],
          activeListTaskIds: [],
          phase: 'active',
          lastPassHadWork: false,
        });
        const delta = AF4Handler.reduce(state, { type: 'ADVANCE_AFTER_FULL_PASS', tasks });
        expect(delta.phase).toBe('backlog');
      });

      it('promotes active list to new backlog when all backlog tasks are done', () => {
        const t1 = makeTask('t1', true);
        const t2 = makeTask('t2');
        const state = makeState({
          backlogTaskIds: ['t1'],
          activeListTaskIds: ['t2'],
          phase: 'backlog',
        });
        const delta = AF4Handler.reduce(state, { type: 'ADVANCE_AFTER_FULL_PASS', tasks: [t1, t2] });
        expect(delta.backlogTaskIds).toEqual(['t2']);
        expect(delta.activeListTaskIds).toEqual([]);
        expect(delta.phase).toBe('backlog');
      });
    });

    describe('FLAG_DISMISSED', () => {
      it('adds current task to dismissedTaskIds', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          currentPosition: 0,
          phase: 'backlog',
        });
        const delta = AF4Handler.reduce(state, { type: 'FLAG_DISMISSED' });
        expect(delta.dismissedTaskIds).toContain('t1');
      });

      it('is idempotent', () => {
        const state = makeState({
          backlogTaskIds: ['t1'],
          dismissedTaskIds: ['t1'],
          currentPosition: 0,
          phase: 'backlog',
        });
        const delta = AF4Handler.reduce(state, { type: 'FLAG_DISMISSED' });
        expect(delta).toEqual({});
      });
    });

    describe('RESOLVE_DISMISSED', () => {
      it('abandon: removes task from all lists and dismissedTaskIds', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          dismissedTaskIds: ['t1'],
        });
        const delta = AF4Handler.reduce(state, { type: 'RESOLVE_DISMISSED', taskId: 't1', resolution: 'abandon' });
        expect(delta.backlogTaskIds).not.toContain('t1');
        expect(delta.dismissedTaskIds).not.toContain('t1');
      });

      it('re-enter: moves task to end of active list, removes from dismissed', () => {
        const state = makeState({
          backlogTaskIds: ['t1', 't2'],
          activeListTaskIds: ['t3'],
          dismissedTaskIds: ['t1'],
        });
        const delta = AF4Handler.reduce(state, { type: 'RESOLVE_DISMISSED', taskId: 't1', resolution: 're-enter' });
        expect(delta.backlogTaskIds).not.toContain('t1');
        expect(delta.activeListTaskIds).toEqual(['t3', 't1']);
        expect(delta.dismissedTaskIds).not.toContain('t1');
      });

      it('defer: removes from dismissedTaskIds only, task stays in backlog', () => {
        const state = makeState({
          backlogTaskIds: ['t1'],
          dismissedTaskIds: ['t1'],
        });
        const delta = AF4Handler.reduce(state, { type: 'RESOLVE_DISMISSED', taskId: 't1', resolution: 'defer' });
        expect(delta.dismissedTaskIds).not.toContain('t1');
        expect(delta.backlogTaskIds).toEqual(['t1']);
      });
    });

    describe('PROMOTE_ACTIVE_LIST', () => {
      it('moves all activeListTaskIds to backlogTaskIds', () => {
        const state = makeState({
          backlogTaskIds: [],
          activeListTaskIds: ['t1', 't2', 't3'],
        });
        const delta = AF4Handler.reduce(state, { type: 'PROMOTE_ACTIVE_LIST' });
        expect(delta.backlogTaskIds).toEqual(['t1', 't2', 't3']);
      });

      it('clears activeListTaskIds', () => {
        const state = makeState({ activeListTaskIds: ['t1', 't2'] });
        const delta = AF4Handler.reduce(state, { type: 'PROMOTE_ACTIVE_LIST' });
        expect(delta.activeListTaskIds).toEqual([]);
      });

      it('resets currentPosition to 0 and phase to backlog', () => {
        const state = makeState({
          activeListTaskIds: ['t1'],
          currentPosition: 5,
          phase: 'active',
        });
        const delta = AF4Handler.reduce(state, { type: 'PROMOTE_ACTIVE_LIST' });
        expect(delta.currentPosition).toBe(0);
        expect(delta.phase).toBe('backlog');
      });
    });
  });

  describe('onActivate', () => {
    it('returns {} (no transient state to reset on activate)', () => {
      const state = makeState({ backlogTaskIds: ['t1'], currentPosition: 0 });
      const delta = AF4Handler.onActivate([], state);
      expect(delta).toEqual({});
    });
  });

  describe('onDeactivate', () => {
    it('returns {} (no transient state to reset on deactivate)', () => {
      const state = makeState({ backlogTaskIds: ['t1'], currentPosition: 0 });
      const delta = AF4Handler.onDeactivate(state);
      expect(delta).toEqual({});
    });
  });
});
