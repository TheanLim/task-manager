import { describe, it, expect } from 'vitest';
import * as FVP from './index';
import type { FVPState } from './index';
import { Task, Priority } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeState = (overrides?: Partial<FVPState>): FVPState => ({
  dottedTasks: [],
  scanPosition: 1,
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

describe('FVPHandler.initialize', () => {
  it('auto-dots the first incomplete task as the baseline', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState();
    const delta = FVP.initialize(tasks, state);
    expect(delta.dottedTasks).toEqual(['t1']);
    expect(delta.scanPosition).toBe(1);
  });

  it('skips completed tasks when finding the first to auto-dot', () => {
    const t1 = makeTask('t1', true);
    const t2 = makeTask('t2');
    const t3 = makeTask('t3');
    const state = makeState();
    const delta = FVP.initialize([t1, t2, t3], state);
    expect(delta.dottedTasks).toEqual(['t2']);
    // scanPosition = 1 because t2 is at index 0 in the incomplete list [t2, t3],
    // so scan starts at index 1 (t3) — the next candidate after the auto-dotted task
    expect(delta.scanPosition).toBe(1);
  });

  it('returns empty dottedTasks when all tasks are completed', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id, true));
    const state = makeState();
    const delta = FVP.initialize(tasks, state);
    expect(delta.dottedTasks).toEqual([]);
    expect(delta.scanPosition).toBe(1);
  });

  it('returns empty dottedTasks when task list is empty', () => {
    const delta = FVP.initialize([], makeState());
    expect(delta.dottedTasks).toEqual([]);
    expect(delta.scanPosition).toBe(1);
  });

  it('clears previous dotted state and re-dots the first incomplete task', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t2', 't3'], scanPosition: 5 });
    const delta = FVP.initialize(tasks, state);
    expect(delta.dottedTasks).toEqual(['t1']);
    expect(delta.scanPosition).toBe(1);
  });
});

// ─── getOrderedTasks ─────────────────────────────────────────────────────────

describe('FVPHandler.getOrderedTasks', () => {
  it('returns dotted tasks first (oldest→newest), then undotted, then completed', () => {
    const [t1, t2, t3, t4] = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const t5 = makeTask('t5', true);
    const state = makeState({ dottedTasks: ['t1', 't3'] });
    const ordered = FVP.getOrderedTasks([t1, t2, t3, t4, t5], state);
    expect(ordered.map(t => t.id)).toEqual(['t1', 't3', 't2', 't4', 't5']);
  });

  it('returns all tasks in natural order when nothing is dotted', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    expect(FVP.getOrderedTasks(tasks, makeState()).map(t => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('skips dotted IDs that no longer exist in the task list', () => {
    const t1 = makeTask('t1');
    const state = makeState({ dottedTasks: ['t1', 'ghost'] });
    const ordered = FVP.getOrderedTasks([t1], state);
    expect(ordered.map(t => t.id)).toEqual(['t1']);
  });
});

// ─── onTaskCreated ────────────────────────────────────────────────────────────

describe('FVPHandler.onTaskCreated', () => {
  it('returns empty delta — new tasks join the undotted pool naturally', () => {
    expect(FVP.onTaskCreated(makeTask('t1'), makeState())).toEqual({});
  });
});

// ─── onTaskCompleted ─────────────────────────────────────────────────────────

describe('FVPHandler.onTaskCompleted', () => {
  it('removes a dotted task from dottedTasks', () => {
    const state = makeState({ dottedTasks: ['t1', 't2', 't3'] });
    const delta = FVP.onTaskCompleted(makeTask('t2'), state);
    expect(delta.dottedTasks).toEqual(['t1', 't3']);
  });

  it('returns empty delta when completing an undotted task', () => {
    const state = makeState({ dottedTasks: ['t2'] });
    expect(FVP.onTaskCompleted(makeTask('t1'), state)).toEqual({});
  });

  it('does not change scanPosition on external completion', () => {
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 3 });
    const delta = FVP.onTaskCompleted(makeTask('t1'), state);
    expect(delta.scanPosition).toBe(3);
  });
});

// ─── getCurrentTask ───────────────────────────────────────────────────────────

describe('FVP.getCurrentTask', () => {
  it('returns the last dotted task', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't2', 't3'] });
    expect(FVP.getCurrentTask(tasks, state)?.id).toBe('t3');
  });

  it('returns null when nothing is dotted', () => {
    expect(FVP.getCurrentTask([], makeState())).toBeNull();
  });
});

// ─── getCurrentX ─────────────────────────────────────────────────────────────

describe('FVP.getCurrentX', () => {
  it('returns last dotted task (the benchmark) when ≥1 dotted', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't2', 't3'] });
    expect(FVP.getCurrentX(tasks, state)?.id).toBe('t3');
  });

  it('returns the single dotted task when exactly 1 dotted', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t3'] });
    expect(FVP.getCurrentX(tasks, state)?.id).toBe('t3');
  });

  it('returns first incomplete task when nothing is dotted (implicit X)', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    expect(FVP.getCurrentX(tasks, makeState())?.id).toBe('t1');
  });

  it('returns null when no tasks and nothing dotted', () => {
    expect(FVP.getCurrentX([], makeState())).toBeNull();
  });
});

// ─── getScanCandidate ─────────────────────────────────────────────────────────

describe('FVP.getScanCandidate', () => {
  it('returns the first undotted incomplete task at or after scanPosition', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 1 });
    expect(FVP.getScanCandidate(tasks, state)?.id).toBe('t2');
  });

  it('skips dotted tasks when scanning', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't2'], scanPosition: 1 });
    expect(FVP.getScanCandidate(tasks, state)?.id).toBe('t3');
  });

  it('returns null when scan is past the end', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({ scanPosition: 10 });
    expect(FVP.getScanCandidate(tasks, state)).toBeNull();
  });

  it('skips completed tasks', () => {
    const t1 = makeTask('t1');
    const t2 = makeTask('t2', true);
    const t3 = makeTask('t3');
    const state = makeState({ scanPosition: 1 });
    expect(FVP.getScanCandidate([t1, t2, t3], state)?.id).toBe('t3');
  });
});

// ─── dotTask ─────────────────────────────────────────────────────────────────

describe('FVP.dotTask', () => {
  it('appends candidate to dottedTasks and advances scanPosition past it', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 1 });
    const delta = FVP.dotTask(makeTask('t2'), tasks, state);
    expect(delta.dottedTasks).toEqual(['t1', 't2']);
    expect(delta.scanPosition).toBe(2);
  });
});

// ─── skipTask ────────────────────────────────────────────────────────────────

describe('FVP.skipTask', () => {
  it('advances scanPosition past the candidate without dotting', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 1 });
    const delta = FVP.skipTask(makeTask('t2'), tasks, state);
    expect(delta.dottedTasks).toEqual(['t1']);
    expect(delta.scanPosition).toBe(2);
  });
});

// ─── completeCurrentTask ─────────────────────────────────────────────────────

describe('FVP.completeCurrentTask', () => {
  it('removes last dotted task and sets scanPosition after its position', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't3'], scanPosition: 4 });
    const delta = FVP.completeCurrentTask(tasks, state);
    expect(delta.dottedTasks).toEqual(['t1']);
    expect(delta.scanPosition).toBe(3);
  });

  it('resets scanPosition to 1 when dottedTasks becomes empty', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t2'], scanPosition: 2 });
    const delta = FVP.completeCurrentTask(tasks, state);
    expect(delta.dottedTasks).toEqual([]);
    expect(delta.scanPosition).toBe(1);
  });

  it('returns empty delta when no dotted tasks', () => {
    expect(FVP.completeCurrentTask([], makeState())).toEqual({});
  });

  it('sets scanPosition to completedIndex + 1 computed from the UNFILTERED incomplete list at call time', () => {
    const t1 = makeTask('t1');
    const t2 = makeTask('t2');
    const t3 = makeTask('t3', true); // already marked complete by caller
    const t4 = makeTask('t4');
    const state = makeState({ dottedTasks: ['t1', 't3'], scanPosition: 4 });

    const delta = FVP.completeCurrentTask([t1, t2, t3, t4], state);

    expect(delta.dottedTasks).toEqual(['t1']);
    expect(delta.scanPosition).toBe(3);
  });

  it('does not depend on task.completed flag — uses position in list at call time', () => {
    const t1 = makeTask('t1');
    const t2 = makeTask('t2', true); // already marked complete by caller
    const t3 = makeTask('t3');
    const t4 = makeTask('t4');
    const state = makeState({ dottedTasks: ['t2'], scanPosition: 2 });

    const delta = FVP.completeCurrentTask([t1, t2, t3, t4], state);

    expect(delta.dottedTasks).toEqual([]);
    expect(delta.scanPosition).toBe(1);
  });

  it('resets scanPosition to 1 when dottedTasks becomes empty after removal', () => {
    const t1 = makeTask('t1', true); // already marked complete by caller
    const t2 = makeTask('t2');
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 1 });

    const delta = FVP.completeCurrentTask([t1, t2], state);

    expect(delta.dottedTasks).toEqual([]);
    expect(delta.scanPosition).toBe(1);
  });
});

// ─── onTaskDeleted ────────────────────────────────────────────────────────────

describe('FVP.onTaskDeleted', () => {
  it('removes deleted taskId from dottedTasks', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't2'], scanPosition: 3 });
    const delta = FVP.onTaskDeleted('t2', tasks, state);
    expect(delta.dottedTasks).toEqual(['t1']);
  });

  it('recalculates scanPosition when deleted task was at an index before scanPosition', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't2'], scanPosition: 3 });
    const delta = FVP.onTaskDeleted('t2', tasks, state);
    expect(delta.scanPosition).toBe(2);
  });

  it('does not change scanPosition when deleted task was at or after scanPosition', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't3'], scanPosition: 2 });
    const delta = FVP.onTaskDeleted('t3', tasks, state);
    expect(delta.scanPosition).toBe(2);
  });

  it('handles deletion of a non-last dotted task without crashing', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't3'], scanPosition: 3 });
    expect(() => FVP.onTaskDeleted('t1', tasks, state)).not.toThrow();
    const delta = FVP.onTaskDeleted('t1', tasks, state);
    expect(delta.dottedTasks).toEqual(['t3']);
  });

  it('returns empty delta when taskId is not in dottedTasks', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 2 });
    expect(FVP.onTaskDeleted('t2', tasks, state)).toEqual({});
  });

  it('handles deletion of the current task (last dotted)', () => {
    const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't3'], scanPosition: 4 });
    const delta = FVP.onTaskDeleted('t3', tasks, state);
    expect(delta.dottedTasks).toEqual(['t1']);
    expect(delta.scanPosition).toBe(4);
  });
});

// ─── resetFVP ────────────────────────────────────────────────────────────────

describe('FVP.resetFVP', () => {
  it('clears all dotted tasks and resets scanPosition to 1', () => {
    const state = makeState({ dottedTasks: ['t1', 't2'], scanPosition: 5 });
    const delta = FVP.resetFVP(state);
    expect(delta).toEqual({ dottedTasks: [], scanPosition: 1 });
  });
});

// ─── isPreselectionComplete ───────────────────────────────────────────────────

describe('FVP.isPreselectionComplete', () => {
  it('returns true when no more candidates exist', () => {
    const tasks = ['t1', 't2'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1', 't2'], scanPosition: 10 });
    expect(FVP.isPreselectionComplete(tasks, state)).toBe(true);
  });

  it('returns false when candidates remain', () => {
    const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
    const state = makeState({ dottedTasks: ['t1'], scanPosition: 1 });
    expect(FVP.isPreselectionComplete(tasks, state)).toBe(false);
  });
});

// ─── FVPHandler (handler object interface) ────────────────────────────────────
// These tests target the FVPHandler OBJECT (task 3.10) — they MUST FAIL before
// task 3.10 is implemented.

import { FVPHandler } from '.';

describe('FVPHandler (handler object interface)', () => {
  describe('reduce', () => {
    describe('START_PRESELECTION', () => {
      it('auto-dots the first incomplete task and sets scanPosition to 1', () => {
        const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
        const state: FVPState = { dottedTasks: ['t1', 't2'], scanPosition: 5 };
        const delta = FVPHandler.reduce(state, { type: 'START_PRESELECTION', tasks });
        expect(delta.dottedTasks).toEqual(['t1']);
        expect(delta.scanPosition).toBe(1);
      });
    });

    describe('DOT_TASK', () => {
      it('appends taskId to dottedTasks and advances scanPosition', () => {
        const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
        const state: FVPState = { dottedTasks: ['t1'], scanPosition: 1 };
        const delta = FVPHandler.reduce(state, { type: 'DOT_TASK', task: makeTask('t2'), tasks });
        expect(delta.dottedTasks).toEqual(['t1', 't2']);
        expect(delta.scanPosition).toBe(2);
      });
    });

    describe('SKIP_CANDIDATE', () => {
      it('advances scanPosition without dotting', () => {
        const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
        const state: FVPState = { dottedTasks: ['t1'], scanPosition: 1 };
        const delta = FVPHandler.reduce(state, { type: 'SKIP_CANDIDATE', task: makeTask('t2'), tasks });
        expect(delta.dottedTasks).toEqual(['t1']);
        expect(delta.scanPosition).toBe(2);
      });
    });

    describe('COMPLETE_CURRENT', () => {
      it('removes last dotted task and sets scanPosition correctly', () => {
        const tasks = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
        const state: FVPState = { dottedTasks: ['t1', 't3'], scanPosition: 4 };
        const delta = FVPHandler.reduce(state, { type: 'COMPLETE_CURRENT', tasks });
        expect(delta.dottedTasks).toEqual(['t1']);
        expect(delta.scanPosition).toBe(3);
      });
    });

    describe('RESET_FVP', () => {
      it('clears all dotted tasks and resets scanPosition to 1', () => {
        const state: FVPState = { dottedTasks: ['t1', 't2'], scanPosition: 5 };
        const delta = FVPHandler.reduce(state, { type: 'RESET_FVP' });
        expect(delta.dottedTasks).toEqual([]);
        expect(delta.scanPosition).toBe(1);
      });
    });
  });

  describe('onActivate', () => {
    it('returns {} (FVP state is preserved on activate)', () => {
      const tasks = ['t1', 't2'].map(id => makeTask(id));
      const state: FVPState = { dottedTasks: ['t1'], scanPosition: 2 };
      const delta = FVPHandler.onActivate(tasks, state);
      expect(delta).toEqual({});
    });
  });

  describe('onDeactivate', () => {
    it('returns {} (FVP state is preserved on deactivate — dotted tasks persist)', () => {
      const state: FVPState = { dottedTasks: ['t1', 't2'], scanPosition: 3 };
      const delta = FVPHandler.onDeactivate(state);
      expect(delta).toEqual({});
    });
  });

  describe('getOrderedTasks', () => {
    it('returns dotted first, undotted after, completed last', () => {
      const [t1, t2, t3, t4] = ['t1', 't2', 't3', 't4'].map(id => makeTask(id));
      const t5 = makeTask('t5', true);
      const state: FVPState = { dottedTasks: ['t1', 't3'], scanPosition: 1 };
      const ordered = FVPHandler.getOrderedTasks([t1, t2, t3, t4, t5], state);
      expect(ordered.map(t => t.id)).toEqual(['t1', 't3', 't2', 't4', 't5']);
    });
  });

  describe('onTaskCompleted (external)', () => {
    it('removes task from dottedTasks if present', () => {
      const state: FVPState = { dottedTasks: ['t1', 't2'], scanPosition: 3 };
      const delta = FVPHandler.onTaskCompleted(makeTask('t1'), state);
      expect(delta.dottedTasks).toEqual(['t2']);
    });

    it('returns empty delta when completing an undotted task', () => {
      const state: FVPState = { dottedTasks: ['t2'], scanPosition: 2 };
      const delta = FVPHandler.onTaskCompleted(makeTask('t1'), state);
      expect(delta).toEqual({});
    });
  });

  describe('onTaskDeleted', () => {
    it('removes deleted taskId from dottedTasks', () => {
      const tasks = ['t1', 't2', 't3'].map(id => makeTask(id));
      const state: FVPState = { dottedTasks: ['t1', 't2'], scanPosition: 3 };
      const delta = FVPHandler.onTaskDeleted('t2', state);
      expect(delta.dottedTasks).toEqual(['t1']);
    });

    it('returns empty delta when taskId is not in dottedTasks', () => {
      const state: FVPState = { dottedTasks: ['t1'], scanPosition: 2 };
      const delta = FVPHandler.onTaskDeleted('t99', state);
      expect(delta).toEqual({});
    });
  });

  describe('identity', () => {
    it('has id "fvp"', () => {
      expect(FVPHandler.id).toBe('fvp');
    });

    it('getInitialState returns dottedTasks [] and scanPosition 1', () => {
      const s = FVPHandler.getInitialState();
      expect(s.dottedTasks).toEqual([]);
      expect(s.scanPosition).toBe(1);
    });

    it('validateState falls back to getInitialState on corrupt input', () => {
      const s = FVPHandler.validateState(null);
      expect(s).toEqual(FVPHandler.getInitialState());
    });
  });
});
