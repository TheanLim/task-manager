import { describe, it, expect } from 'vitest';
import * as AF4 from './AF4Handler';
import { Task, TMSState, Priority, TimeManagementSystem } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeTMSState = (af4Overrides?: Partial<TMSState['af4']>): TMSState => ({
  activeSystem: TimeManagementSystem.AF4,
  dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
  af4: {
    backlogTaskIds: [],
    activeListTaskIds: [],
    currentPosition: 0,
    lastPassHadWork: false,
    passStartPosition: 0,
    dismissedTaskIds: [],
    phase: 'backlog',
    ...af4Overrides,
  },
  fvp: { dottedTasks: [], scanPosition: 1 },
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
    const state = makeTMSState();
    const delta = AF4.initialize(tasks, state);
    expect(delta.af4?.backlogTaskIds).toEqual(['t1', 't2']);
    expect(delta.af4?.activeListTaskIds).toEqual([]);
    expect(delta.af4?.currentPosition).toBe(0);
    expect(delta.af4?.phase).toBe('backlog');
  });

  it('handles empty task list', () => {
    const delta = AF4.initialize([], makeTMSState());
    expect(delta.af4?.backlogTaskIds).toEqual([]);
  });
});

// ─── getOrderedTasks ─────────────────────────────────────────────────────────

describe('AF4Handler.getOrderedTasks', () => {
  it('returns backlog first, then active list, then unlisted tasks', () => {
    const [t1, t2, t3, t4] = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeTMSState({
      backlogTaskIds: ['t2', 't1'],
      activeListTaskIds: ['t3'],
    });
    const ordered = AF4.getOrderedTasks([t1, t2, t3, t4], state);
    expect(ordered.map(t => t.id)).toEqual(['t2', 't1', 't3', 't4']);
  });

  it('skips IDs that no longer exist in the task list', () => {
    const t1 = makeTask('t1');
    const state = makeTMSState({ backlogTaskIds: ['t1', 'ghost'] });
    const ordered = AF4.getOrderedTasks([t1], state);
    expect(ordered.map(t => t.id)).toEqual(['t1']);
  });
});

// ─── onTaskCreated ────────────────────────────────────────────────────────────

describe('AF4Handler.onTaskCreated', () => {
  it('appends new task to end of active list', () => {
    const state = makeTMSState({ activeListTaskIds: ['t1'] });
    const delta = AF4.onTaskCreated(makeTask('t2'), state);
    expect(delta.af4?.activeListTaskIds).toEqual(['t1', 't2']);
  });

  it('does not touch backlog', () => {
    const state = makeTMSState({ backlogTaskIds: ['t1'] });
    const delta = AF4.onTaskCreated(makeTask('t2'), state);
    expect(delta.af4?.backlogTaskIds).toEqual(['t1']);
  });
});

// ─── onTaskCompleted ─────────────────────────────────────────────────────────

describe('AF4Handler.onTaskCompleted', () => {
  it('removes task from backlog', () => {
    const state = makeTMSState({ backlogTaskIds: ['t1', 't2', 't3'] });
    const delta = AF4.onTaskCompleted(makeTask('t2'), state);
    expect(delta.af4?.backlogTaskIds).toEqual(['t1', 't3']);
  });

  it('removes task from active list', () => {
    const state = makeTMSState({ activeListTaskIds: ['t1', 't2'] });
    const delta = AF4.onTaskCompleted(makeTask('t1'), state);
    expect(delta.af4?.activeListTaskIds).toEqual(['t2']);
  });

  it('decrements currentPosition when completed task was before cursor', () => {
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2', 't3'],
      currentPosition: 2,
    });
    const delta = AF4.onTaskCompleted(makeTask('t1'), state);
    expect(delta.af4?.currentPosition).toBe(1);
  });

  it('does not change currentPosition when completed task is at or after cursor', () => {
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2', 't3'],
      currentPosition: 1,
    });
    const delta = AF4.onTaskCompleted(makeTask('t2'), state);
    expect(delta.af4?.currentPosition).toBe(1);
  });

  it('returns empty delta for task not in either list', () => {
    const state = makeTMSState({ backlogTaskIds: ['t1'] });
    expect(AF4.onTaskCompleted(makeTask('t99'), state)).toEqual({});
  });
});

// ─── getCurrentTask ───────────────────────────────────────────────────────────

describe('AF4.getCurrentTask', () => {
  it('returns task at currentPosition in backlog phase', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ backlogTaskIds: ['t1', 't2', 't3'], currentPosition: 1 });
    expect(AF4.getCurrentTask(tasks, state)?.id).toBe('t2');
  });

  it('returns task at currentPosition in active phase', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({
      activeListTaskIds: ['t1', 't2'],
      currentPosition: 0,
      phase: 'active',
    });
    expect(AF4.getCurrentTask(tasks, state)?.id).toBe('t1');
  });

  it('returns null when list is empty', () => {
    expect(AF4.getCurrentTask([], makeTMSState())).toBeNull();
  });

  it('returns null when currentPosition is past end of list', () => {
    const tasks = ['t1'].map(id => makeTask(id));
    const state = makeTMSState({ backlogTaskIds: ['t1'], currentPosition: 5 });
    expect(AF4.getCurrentTask(tasks, state)).toBeNull();
  });
});

// ─── didWork ─────────────────────────────────────────────────────────────────

describe('AF4.didWork', () => {
  it('removes task from backlog, re-enters at end of active list', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2', 't3'],
      activeListTaskIds: [],
      currentPosition: 1,
    });
    const delta = AF4.didWork(tasks, state);
    expect(delta.af4?.backlogTaskIds).toEqual(['t1', 't3']);
    expect(delta.af4?.activeListTaskIds).toEqual(['t2']);
    expect(delta.af4?.lastPassHadWork).toBe(true);
  });

  it('currentPosition stays the same (now points to next task)', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2'],
      currentPosition: 0,
    });
    const delta = AF4.didWork(tasks, state);
    expect(delta.af4?.currentPosition).toBe(0);
  });
});

// ─── skipTask ────────────────────────────────────────────────────────────────

describe('AF4.skipTask', () => {
  it('increments currentPosition by 1', () => {
    const state = makeTMSState({ currentPosition: 2 });
    const delta = AF4.skipTask(state);
    expect(delta.af4?.currentPosition).toBe(3);
  });
});

// ─── isFullPassComplete ───────────────────────────────────────────────────────

describe('AF4.isFullPassComplete', () => {
  it('returns true when currentPosition >= list length', () => {
    const state = makeTMSState({ backlogTaskIds: ['t1', 't2'], currentPosition: 2 });
    expect(AF4.isFullPassComplete(state)).toBe(true);
  });

  it('returns false when still within the list', () => {
    const state = makeTMSState({ backlogTaskIds: ['t1', 't2'], currentPosition: 1 });
    expect(AF4.isFullPassComplete(state)).toBe(false);
  });
});

// ─── advanceAfterFullPass ─────────────────────────────────────────────────────

describe('AF4.advanceAfterFullPass', () => {
  it('switches to active phase when backlog pass had no work', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2'],
      lastPassHadWork: false,
      phase: 'backlog',
    });
    const delta = AF4.advanceAfterFullPass(tasks, state);
    expect(delta.af4?.phase).toBe('active');
    expect(delta.af4?.currentPosition).toBe(0);
  });

  it('restarts backlog from 0 when backlog pass had work', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2'],
      lastPassHadWork: true,
      phase: 'backlog',
    });
    const delta = AF4.advanceAfterFullPass(tasks, state);
    expect(delta.af4?.phase).toBe('backlog');
    expect(delta.af4?.currentPosition).toBe(0);
    expect(delta.af4?.lastPassHadWork).toBe(false);
  });

  it('returns to backlog after active pass completes', () => {
    const tasks = ['t1'].map(id => makeTask(id));
    const state = makeTMSState({
      backlogTaskIds: ['t1'],
      activeListTaskIds: [],
      phase: 'active',
      lastPassHadWork: false,
    });
    const delta = AF4.advanceAfterFullPass(tasks, state);
    expect(delta.af4?.phase).toBe('backlog');
  });

  it('promotes active list to new backlog when all backlog tasks are done', () => {
    const t1 = makeTask('t1', true); // completed
    const t2 = makeTask('t2');
    const state = makeTMSState({
      backlogTaskIds: ['t1'],
      activeListTaskIds: ['t2'],
      phase: 'backlog',
    });
    const delta = AF4.advanceAfterFullPass([t1, t2], state);
    expect(delta.af4?.backlogTaskIds).toEqual(['t2']);
    expect(delta.af4?.activeListTaskIds).toEqual([]);
    expect(delta.af4?.phase).toBe('backlog');
  });
});

// ─── dismissTask / resolveDismissed ───────────────────────────────────────────

describe('AF4.dismissTask', () => {
  it('adds task to dismissedTaskIds', () => {
    const state = makeTMSState({ backlogTaskIds: ['t1'] });
    const delta = AF4.dismissTask('t1', state);
    expect(delta.af4?.dismissedTaskIds).toContain('t1');
  });

  it('is idempotent', () => {
    const state = makeTMSState({ dismissedTaskIds: ['t1'] });
    expect(AF4.dismissTask('t1', state)).toEqual({});
  });
});

describe('AF4.resolveDismissed', () => {
  it('abandon removes task from all lists', () => {
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2'],
      dismissedTaskIds: ['t1'],
    });
    const delta = AF4.resolveDismissed('t1', 'abandon', state);
    expect(delta.af4?.backlogTaskIds).not.toContain('t1');
    expect(delta.af4?.dismissedTaskIds).not.toContain('t1');
  });

  it('re-enter moves task from backlog to end of active list', () => {
    const state = makeTMSState({
      backlogTaskIds: ['t1', 't2'],
      activeListTaskIds: ['t3'],
      dismissedTaskIds: ['t1'],
    });
    const delta = AF4.resolveDismissed('t1', 're-enter', state);
    expect(delta.af4?.backlogTaskIds).not.toContain('t1');
    expect(delta.af4?.activeListTaskIds).toEqual(['t3', 't1']);
    expect(delta.af4?.dismissedTaskIds).not.toContain('t1');
  });

  it('defer removes from dismissed but keeps in backlog', () => {
    const state = makeTMSState({
      backlogTaskIds: ['t1'],
      dismissedTaskIds: ['t1'],
    });
    const delta = AF4.resolveDismissed('t1', 'defer', state);
    expect(delta.af4?.dismissedTaskIds).not.toContain('t1');
    // backlog is preserved unchanged
    expect(delta.af4?.backlogTaskIds).toEqual(['t1']);
  });
});
