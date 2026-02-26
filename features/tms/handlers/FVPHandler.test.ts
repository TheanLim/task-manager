import { describe, it, expect } from 'vitest';
import * as FVP from './FVPHandler';
import { Task, TMSState, Priority, TimeManagementSystem } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeTMSState = (fvpOverrides?: Partial<TMSState['fvp']>): TMSState => ({
  activeSystem: TimeManagementSystem.FVP,
  dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
  af4: {
    backlogTaskIds: [],
    activeListTaskIds: [],
    currentPosition: 0,
    lastPassHadWork: false,
    passStartPosition: 0,
    dismissedTaskIds: [],
    phase: 'backlog',
  },
  fvp: {
    dottedTasks: [],
    scanPosition: 1,
    ...fvpOverrides,
  },
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

describe('FVPHandler.initialize', () => {
  it('resets to clean state with scanPosition=1', () => {
    const state = makeTMSState({ dottedTasks: ['t1', 't2'], scanPosition: 5 });
    const delta = FVP.initialize([], state);
    expect(delta.fvp).toEqual({ dottedTasks: [], scanPosition: 1 });
  });
});

// ─── getOrderedTasks ─────────────────────────────────────────────────────────

describe('FVPHandler.getOrderedTasks', () => {
  it('returns dotted tasks first (oldest→newest), then undotted, then completed', () => {
    const [t1, t2, t3, t4] = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const t5 = makeTask('t5', true);
    const state = makeTMSState({ dottedTasks: ['t1', 't3'] });
    const ordered = FVP.getOrderedTasks([t1, t2, t3, t4, t5], state);
    expect(ordered.map(t => t.id)).toEqual(['t1', 't3', 't2', 't4', 't5']);
  });

  it('returns all tasks in natural order when nothing is dotted', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState();
    expect(FVP.getOrderedTasks(tasks, state).map(t => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('skips dotted IDs that no longer exist in the task list', () => {
    const t1 = makeTask('t1');
    const state = makeTMSState({ dottedTasks: ['t1', 'ghost'] });
    const ordered = FVP.getOrderedTasks([t1], state);
    expect(ordered.map(t => t.id)).toEqual(['t1']);
  });
});

// ─── onTaskCreated ────────────────────────────────────────────────────────────

describe('FVPHandler.onTaskCreated', () => {
  it('returns empty delta — new tasks join the undotted pool naturally', () => {
    const state = makeTMSState();
    expect(FVP.onTaskCreated(makeTask('t1'), state)).toEqual({});
  });
});

// ─── onTaskCompleted ─────────────────────────────────────────────────────────

describe('FVPHandler.onTaskCompleted', () => {
  it('removes a dotted task from dottedTasks', () => {
    const state = makeTMSState({ dottedTasks: ['t1', 't2', 't3'] });
    const delta = FVP.onTaskCompleted(makeTask('t2'), state);
    expect(delta.fvp?.dottedTasks).toEqual(['t1', 't3']);
  });

  it('returns empty delta when completing an undotted task', () => {
    const state = makeTMSState({ dottedTasks: ['t2'] });
    expect(FVP.onTaskCompleted(makeTask('t1'), state)).toEqual({});
  });

  it('does not change scanPosition on external completion', () => {
    const state = makeTMSState({ dottedTasks: ['t1'], scanPosition: 3 });
    const delta = FVP.onTaskCompleted(makeTask('t1'), state);
    expect(delta.fvp?.scanPosition).toBe(3);
  });
});

// ─── getCurrentTask ───────────────────────────────────────────────────────────

describe('FVP.getCurrentTask', () => {
  it('returns the last dotted task', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1', 't2', 't3'] });
    expect(FVP.getCurrentTask(tasks, state)?.id).toBe('t3');
  });

  it('returns null when nothing is dotted', () => {
    expect(FVP.getCurrentTask([], makeTMSState())).toBeNull();
  });
});

// ─── getCurrentX ─────────────────────────────────────────────────────────────

describe('FVP.getCurrentX', () => {
  it('returns second-to-last dotted task when ≥2 dotted', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1', 't2', 't3'] });
    expect(FVP.getCurrentX(tasks, state)?.id).toBe('t2');
  });

  it('returns first undotted task when <2 dotted (implicit X)', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t3'] });
    // t1 and t2 are undotted; t1 is first
    expect(FVP.getCurrentX(tasks, state)?.id).toBe('t1');
  });

  it('returns null when no undotted tasks remain', () => {
    const tasks = ['t1'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1'] });
    expect(FVP.getCurrentX(tasks, state)).toBeNull();
  });
});

// ─── getScanCandidate ─────────────────────────────────────────────────────────

describe('FVP.getScanCandidate', () => {
  it('returns the first undotted incomplete task at or after scanPosition', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1'], scanPosition: 1 });
    // incomplete list: [t1,t2,t3,t4]; scan from index 1 → t2 is undotted
    expect(FVP.getScanCandidate(tasks, state)?.id).toBe('t2');
  });

  it('skips dotted tasks when scanning', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1', 't2'], scanPosition: 1 });
    // scan from 1: t2 is dotted, t3 is not → t3
    expect(FVP.getScanCandidate(tasks, state)?.id).toBe('t3');
  });

  it('returns null when scan is past the end', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({ scanPosition: 10 });
    expect(FVP.getScanCandidate(tasks, state)).toBeNull();
  });

  it('skips completed tasks', () => {
    const t1 = makeTask('t1');
    const t2 = makeTask('t2', true); // completed
    const t3 = makeTask('t3');
    const state = makeTMSState({ scanPosition: 1 });
    // incomplete list: [t1, t3]; scan from 1 → t3
    expect(FVP.getScanCandidate([t1, t2, t3], state)?.id).toBe('t3');
  });
});

// ─── dotTask ─────────────────────────────────────────────────────────────────

describe('FVP.dotTask', () => {
  it('appends candidate to dottedTasks and advances scanPosition past it', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1'], scanPosition: 1 });
    const delta = FVP.dotTask(makeTask('t2'), tasks, state);
    expect(delta.fvp?.dottedTasks).toEqual(['t1', 't2']);
    expect(delta.fvp?.scanPosition).toBe(2); // index of t2 in incomplete list is 1, +1 = 2
  });
});

// ─── skipTask ────────────────────────────────────────────────────────────────

describe('FVP.skipTask', () => {
  it('advances scanPosition past the candidate without dotting', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1'], scanPosition: 1 });
    const delta = FVP.skipTask(makeTask('t2'), tasks, state);
    // dottedTasks is preserved unchanged
    expect(delta.fvp?.dottedTasks).toEqual(['t1']);
    expect(delta.fvp?.scanPosition).toBe(2);
  });
});

// ─── completeCurrentTask ─────────────────────────────────────────────────────

describe('FVP.completeCurrentTask', () => {
  it('removes last dotted task and sets scanPosition after its position', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1', 't3'], scanPosition: 4 });
    // current task = t3; incomplete list index of t3 = 2; new scanPosition = 3
    const delta = FVP.completeCurrentTask(tasks, state);
    expect(delta.fvp?.dottedTasks).toEqual(['t1']);
    expect(delta.fvp?.scanPosition).toBe(3);
  });

  it('resets scanPosition to 1 when dottedTasks becomes empty', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t2'], scanPosition: 2 });
    const delta = FVP.completeCurrentTask(tasks, state);
    expect(delta.fvp?.dottedTasks).toEqual([]);
    expect(delta.fvp?.scanPosition).toBe(1);
  });

  it('returns empty delta when no dotted tasks', () => {
    const state = makeTMSState();
    expect(FVP.completeCurrentTask([], state)).toEqual({});
  });
});

// ─── resetFVP ────────────────────────────────────────────────────────────────

describe('FVP.resetFVP', () => {
  it('clears all dotted tasks and resets scanPosition to 1', () => {
    const state = makeTMSState({ dottedTasks: ['t1', 't2'], scanPosition: 5 });
    const delta = FVP.resetFVP(state);
    expect(delta.fvp).toEqual({ dottedTasks: [], scanPosition: 1 });
  });
});

// ─── isPreselectionComplete ───────────────────────────────────────────────────

describe('FVP.isPreselectionComplete', () => {
  it('returns true when no more candidates exist', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1', 't2'], scanPosition: 10 });
    expect(FVP.isPreselectionComplete(tasks, state)).toBe(true);
  });

  it('returns false when candidates remain', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeTMSState({ dottedTasks: ['t1'], scanPosition: 1 });
    expect(FVP.isPreselectionComplete(tasks, state)).toBe(false);
  });
});
