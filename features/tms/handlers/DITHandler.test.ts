import { describe, it, expect } from 'vitest';
import { DITHandler } from './DITHandler';
import type { DITState } from './DITHandler';
import { Task, Priority } from '@/types';

const makeState = (overrides?: Partial<DITState>): DITState => ({
  todayTasks: [],
  tomorrowTasks: [],
  lastDayChange: new Date().toISOString(),
  ...overrides,
});

const makeTask = (id: string, description = `Task ${id}`): Task => ({
  id,
  projectId: 'project-1',
  parentTaskId: null,
  sectionId: null,
  description,
  notes: '',
  assignee: '',
  priority: Priority.NONE,
  tags: [],
  dueDate: null,
  completed: false,
  completedAt: null,
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ── Handler object interface tests (task 3.5) ─────────────────────────────────

describe('DITHandler (handler object interface)', () => {
  const handler = DITHandler;

  describe('onActivate — day rollover', () => {
    it('moves tomorrowTasks to todayTasks when lastDayChange is a previous day', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const state = makeState({
        todayTasks: ['t1'],
        tomorrowTasks: ['t2', 't3'],
        lastDayChange: yesterday.toISOString(),
      });
      const delta = handler.onActivate([], state);
      expect(delta.todayTasks).toEqual(['t2', 't3']);
    });

    it('clears tomorrowTasks after rollover', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const state = makeState({
        tomorrowTasks: ['t2', 't3'],
        lastDayChange: yesterday.toISOString(),
      });
      const delta = handler.onActivate([], state);
      expect(delta.tomorrowTasks).toEqual([]);
    });

    it('updates lastDayChange to today after rollover', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const state = makeState({ lastDayChange: yesterday.toISOString() });
      const delta = handler.onActivate([], state);
      const today = new Date().toISOString().split('T')[0];
      expect(delta.lastDayChange?.split('T')[0]).toBe(today);
    });

    it('returns {} (no change) when lastDayChange is already today', () => {
      const state = makeState({ lastDayChange: new Date().toISOString() });
      const delta = handler.onActivate([], state);
      expect(delta).toEqual({});
    });

    it('handles empty tomorrowTasks on rollover — todayTasks becomes []', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const state = makeState({
        tomorrowTasks: [],
        lastDayChange: yesterday.toISOString(),
      });
      const delta = handler.onActivate([], state);
      expect(delta.todayTasks).toEqual([]);
    });
  });

  describe('getOrderedTasks', () => {
    it('returns today tasks first in todayTasks order', () => {
      const t1 = makeTask('t1');
      const t2 = makeTask('t2');
      const t3 = makeTask('t3');
      const state = makeState({ todayTasks: ['t1', 't3'], tomorrowTasks: ['t2'] });
      const ordered = handler.getOrderedTasks([t1, t2, t3], state);
      expect(ordered[0].id).toBe('t1');
      expect(ordered[1].id).toBe('t3');
    });

    it('returns tomorrow tasks after today tasks', () => {
      const t1 = makeTask('t1');
      const t2 = makeTask('t2');
      const state = makeState({ todayTasks: ['t1'], tomorrowTasks: ['t2'] });
      const ordered = handler.getOrderedTasks([t1, t2], state);
      expect(ordered[0].id).toBe('t1');
      expect(ordered[1].id).toBe('t2');
    });

    it('returns unscheduled tasks (not in either list) last', () => {
      const t1 = makeTask('t1');
      const t2 = makeTask('t2');
      const t3 = makeTask('t3');
      const state = makeState({ todayTasks: ['t1'], tomorrowTasks: [] });
      const ordered = handler.getOrderedTasks([t1, t2, t3], state);
      expect(ordered[0].id).toBe('t1');
      // t2 and t3 are unscheduled — come last
      expect(ordered.slice(1).map((t: Task) => t.id)).toContain('t2');
      expect(ordered.slice(1).map((t: Task) => t.id)).toContain('t3');
    });

    it('handles tasks that appear in both lists (edge case — today wins)', () => {
      const t1 = makeTask('t1');
      const state = makeState({ todayTasks: ['t1'], tomorrowTasks: ['t1'] });
      const ordered = handler.getOrderedTasks([t1], state);
      // t1 should appear only once (in today section)
      expect(ordered.filter((t: Task) => t.id === 't1')).toHaveLength(1);
      expect(ordered[0].id).toBe('t1');
    });
  });

  describe('onTaskCreated', () => {
    it('appends new task to end of tomorrowTasks', () => {
      const state = makeState({ tomorrowTasks: ['existing'] });
      const task = makeTask('new-task');
      const delta = handler.onTaskCreated(task, state);
      expect(delta.tomorrowTasks).toEqual(['existing', 'new-task']);
    });

    it('does not modify todayTasks', () => {
      const state = makeState({ todayTasks: ['t1'] });
      const task = makeTask('new-task');
      const delta = handler.onTaskCreated(task, state);
      expect(delta.todayTasks).toBeUndefined();
    });
  });

  describe('onTaskCompleted', () => {
    it('removes task from todayTasks', () => {
      const state = makeState({ todayTasks: ['t1', 't2'] });
      const delta = handler.onTaskCompleted(makeTask('t1'), state);
      expect(delta.todayTasks).not.toContain('t1');
      expect(delta.todayTasks).toContain('t2');
    });

    it('removes task from tomorrowTasks', () => {
      const state = makeState({ tomorrowTasks: ['t1', 't2'] });
      const delta = handler.onTaskCompleted(makeTask('t1'), state);
      expect(delta.tomorrowTasks).not.toContain('t1');
      expect(delta.tomorrowTasks).toContain('t2');
    });

    it('returns empty delta when task is in neither list', () => {
      const state = makeState({ todayTasks: ['t2'], tomorrowTasks: ['t3'] });
      const delta = handler.onTaskCompleted(makeTask('t1'), state);
      // delta should not contain t1 in any list
      expect(delta.todayTasks).not.toContain('t1');
      expect(delta.tomorrowTasks).not.toContain('t1');
    });
  });

  describe('onTaskDeleted', () => {
    it('removes taskId from todayTasks', () => {
      const state = makeState({ todayTasks: ['t1', 't2'] });
      const delta = handler.onTaskDeleted('t1', state);
      expect(delta.todayTasks).not.toContain('t1');
      expect(delta.todayTasks).toContain('t2');
    });

    it('removes taskId from tomorrowTasks', () => {
      const state = makeState({ tomorrowTasks: ['t1', 't2'] });
      const delta = handler.onTaskDeleted('t1', state);
      expect(delta.tomorrowTasks).not.toContain('t1');
      expect(delta.tomorrowTasks).toContain('t2');
    });

    it('returns empty delta when taskId is in neither list', () => {
      const state = makeState({ todayTasks: ['t2'], tomorrowTasks: ['t3'] });
      const delta = handler.onTaskDeleted('t1', state);
      expect(delta.todayTasks).not.toContain('t1');
      expect(delta.tomorrowTasks).not.toContain('t1');
    });
  });

  describe('reduce', () => {
    describe('MOVE_TO_TODAY', () => {
      it('adds taskId to todayTasks', () => {
        const state = makeState({ todayTasks: [], tomorrowTasks: ['t1'] });
        const delta = handler.reduce(state, { type: 'MOVE_TO_TODAY', taskId: 't1' });
        expect(delta.todayTasks).toContain('t1');
      });

      it('removes taskId from tomorrowTasks if present', () => {
        const state = makeState({ todayTasks: [], tomorrowTasks: ['t1', 't2'] });
        const delta = handler.reduce(state, { type: 'MOVE_TO_TODAY', taskId: 't1' });
        expect(delta.tomorrowTasks).not.toContain('t1');
        expect(delta.tomorrowTasks).toContain('t2');
      });

      it('does not duplicate if already in todayTasks', () => {
        const state = makeState({ todayTasks: ['t1'], tomorrowTasks: [] });
        const delta = handler.reduce(state, { type: 'MOVE_TO_TODAY', taskId: 't1' });
        expect(delta.todayTasks!.filter((id: string) => id === 't1')).toHaveLength(1);
      });
    });

    describe('MOVE_TO_TOMORROW', () => {
      it('adds taskId to tomorrowTasks', () => {
        const state = makeState({ todayTasks: ['t1'], tomorrowTasks: [] });
        const delta = handler.reduce(state, { type: 'MOVE_TO_TOMORROW', taskId: 't1' });
        expect(delta.tomorrowTasks).toContain('t1');
      });

      it('removes taskId from todayTasks if present', () => {
        const state = makeState({ todayTasks: ['t1', 't2'], tomorrowTasks: [] });
        const delta = handler.reduce(state, { type: 'MOVE_TO_TOMORROW', taskId: 't1' });
        expect(delta.todayTasks).not.toContain('t1');
        expect(delta.todayTasks).toContain('t2');
      });
    });

    describe('REMOVE_FROM_SCHEDULE', () => {
      it('removes taskId from both todayTasks and tomorrowTasks', () => {
        const state = makeState({ todayTasks: ['t1'], tomorrowTasks: ['t1'] });
        const delta = handler.reduce(state, { type: 'REMOVE_FROM_SCHEDULE', taskId: 't1' });
        expect(delta.todayTasks).not.toContain('t1');
        expect(delta.tomorrowTasks).not.toContain('t1');
      });

      it('returns empty-ish delta when task is in neither list', () => {
        const state = makeState({ todayTasks: ['t2'], tomorrowTasks: ['t3'] });
        const delta = handler.reduce(state, { type: 'REMOVE_FROM_SCHEDULE', taskId: 't1' });
        expect(delta.todayTasks).not.toContain('t1');
        expect(delta.tomorrowTasks).not.toContain('t1');
      });
    });
  });
});
