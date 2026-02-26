import { describe, it, expect } from 'vitest';
import { StandardHandler } from './StandardHandler';
import { Task, Priority } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeTask = (id: string, order = 0): Task => ({
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
  completed: false,
  completedAt: null,
  order,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ─── getOrderedTasks ─────────────────────────────────────────────────────────

describe('StandardHandler', () => {
  describe('getOrderedTasks', () => {
    it('returns tasks in the order provided (natural order — host applies sorting)', () => {
      const tasks = [makeTask('t3'), makeTask('t1'), makeTask('t2')];
      const result = StandardHandler.getOrderedTasks(tasks, {});
      expect(result.map(t => t.id)).toEqual(['t3', 't1', 't2']);
    });

    it('returns empty array for empty input', () => {
      expect(StandardHandler.getOrderedTasks([], {})).toEqual([]);
    });
  });

  describe('onActivate / onDeactivate', () => {
    it('onActivate returns {} (no state to initialize)', () => {
      expect(StandardHandler.onActivate([makeTask('t1')], {})).toEqual({});
    });

    it('onDeactivate returns {} (no transient state to reset)', () => {
      expect(StandardHandler.onDeactivate({})).toEqual({});
    });
  });

  describe('onTaskDeleted / onTaskCompleted / onTaskCreated', () => {
    it('all return {} — StandardHandler has no state to maintain', () => {
      const task = makeTask('t1');
      expect(StandardHandler.onTaskCreated(task, {})).toEqual({});
      expect(StandardHandler.onTaskCompleted(task, {})).toEqual({});
      expect(StandardHandler.onTaskDeleted('t1', {})).toEqual({});
    });
  });
});
