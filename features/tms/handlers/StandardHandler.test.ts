import { describe, it, expect } from 'vitest';
import * as StandardHandler from './StandardHandler';
import { Task, TMSState, Priority, TimeManagementSystem } from '@/types';

const createDefaultTMSState = (): TMSState => ({
  activeSystem: TimeManagementSystem.NONE,
  dit: {
    todayTasks: [],
    tomorrowTasks: [],
    lastDayChange: new Date().toISOString(),
  },
  af4: {
    markedTasks: [],
    markedOrder: [],
  },
  fvp: {
    dottedTasks: [],
    currentX: null,
    selectionInProgress: false,
  },
});

const createTask = (id: string, description: string, order: number): Task => ({
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
  order,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('StandardHandler', () => {
  describe('initialize', () => {
    it('should not modify state', () => {
      const tmsState = createDefaultTMSState();
      const delta = StandardHandler.initialize([], tmsState);
      expect(delta).toEqual({});
    });
  });

  describe('getOrderedTasks', () => {
    it('should return tasks sorted by order field', () => {
      const task1 = createTask('task-1', 'Third task', 3);
      const task2 = createTask('task-2', 'First task', 1);
      const task3 = createTask('task-3', 'Second task', 2);
      const tmsState = createDefaultTMSState();

      const ordered = StandardHandler.getOrderedTasks([task1, task2, task3], tmsState);

      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-2');
      expect(ordered[1].id).toBe('task-3');
      expect(ordered[2].id).toBe('task-1');
    });

    it('should handle tasks with same order', () => {
      const task1 = createTask('task-1', 'Task 1', 1);
      const task2 = createTask('task-2', 'Task 2', 1);
      const task3 = createTask('task-3', 'Task 3', 2);
      const tmsState = createDefaultTMSState();

      const ordered = StandardHandler.getOrderedTasks([task1, task2, task3], tmsState);

      expect(ordered).toHaveLength(3);
      expect(ordered[2].id).toBe('task-3');
      expect([ordered[0].id, ordered[1].id]).toContain('task-1');
      expect([ordered[0].id, ordered[1].id]).toContain('task-2');
    });

    it('should handle empty task list', () => {
      const tmsState = createDefaultTMSState();
      const ordered = StandardHandler.getOrderedTasks([], tmsState);
      expect(ordered).toEqual([]);
    });

    it('should handle single task', () => {
      const task = createTask('task-1', 'Only task', 1);
      const tmsState = createDefaultTMSState();

      const ordered = StandardHandler.getOrderedTasks([task], tmsState);

      expect(ordered).toHaveLength(1);
      expect(ordered[0]).toEqual(task);
    });

    it('should not mutate original array', () => {
      const task1 = createTask('task-1', 'Task 1', 2);
      const task2 = createTask('task-2', 'Task 2', 1);
      const original = [task1, task2];
      const tmsState = createDefaultTMSState();

      StandardHandler.getOrderedTasks(original, tmsState);

      expect(original[0]).toBe(task1);
      expect(original[1]).toBe(task2);
    });
  });

  describe('onTaskCreated', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'New task', 1);
      const tmsState = createDefaultTMSState();

      const delta = StandardHandler.onTaskCreated(task, tmsState);
      expect(delta).toEqual({});
    });
  });

  describe('onTaskCompleted', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'Completed task', 1);
      const tmsState = createDefaultTMSState();

      const delta = StandardHandler.onTaskCompleted(task, tmsState);
      expect(delta).toEqual({});
    });
  });
});
