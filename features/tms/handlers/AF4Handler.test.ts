import { describe, it, expect } from 'vitest';
import * as AF4Handler from './AF4Handler';
import { Task, TMSState, Priority, TimeManagementSystem } from '@/types';

const createDefaultTMSState = (overrides?: Partial<TMSState['af4']>): TMSState => ({
  activeSystem: TimeManagementSystem.AF4,
  dit: {
    todayTasks: [],
    tomorrowTasks: [],
    lastDayChange: new Date().toISOString(),
  },
  af4: {
    markedTasks: [],
    markedOrder: [],
    ...overrides,
  },
  fvp: {
    dottedTasks: [],
    currentX: null,
    selectionInProgress: false,
  },
});

const createTask = (id: string, description: string): Task => ({
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

describe('AF4Handler', () => {
  describe('initialize', () => {
    it('should not modify state', () => {
      const tmsState = createDefaultTMSState();
      const delta = AF4Handler.initialize([], tmsState);
      expect(delta).toEqual({});
    });
  });

  describe('getOrderedTasks', () => {
    it('should return marked tasks first in marked order', () => {
      const task1 = createTask('task-1', 'First marked');
      const task2 = createTask('task-2', 'Second marked');
      const task3 = createTask('task-3', 'Unmarked');

      const tmsState = createDefaultTMSState({
        markedTasks: ['task-1', 'task-2'],
        markedOrder: ['task-1', 'task-2'],
      });

      const ordered = AF4Handler.getOrderedTasks([task1, task2, task3], tmsState);

      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-1');
      expect(ordered[1].id).toBe('task-2');
      expect(ordered[2].id).toBe('task-3');
    });

    it('should preserve marked order even if tasks are provided in different order', () => {
      const task1 = createTask('task-1', 'Second marked');
      const task2 = createTask('task-2', 'First marked');
      const task3 = createTask('task-3', 'Third marked');

      const tmsState = createDefaultTMSState({
        markedTasks: ['task-2', 'task-1', 'task-3'],
        markedOrder: ['task-2', 'task-1', 'task-3'],
      });

      const ordered = AF4Handler.getOrderedTasks([task1, task2, task3], tmsState);

      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-2');
      expect(ordered[1].id).toBe('task-1');
      expect(ordered[2].id).toBe('task-3');
    });

    it('should return all unmarked tasks when no tasks are marked', () => {
      const task1 = createTask('task-1', 'Task 1');
      const task2 = createTask('task-2', 'Task 2');
      const tmsState = createDefaultTMSState();

      const ordered = AF4Handler.getOrderedTasks([task1, task2], tmsState);

      expect(ordered).toHaveLength(2);
      expect(ordered).toContainEqual(task1);
      expect(ordered).toContainEqual(task2);
    });

    it('should handle empty task list', () => {
      const tmsState = createDefaultTMSState();
      const ordered = AF4Handler.getOrderedTasks([], tmsState);
      expect(ordered).toEqual([]);
    });

    it('should handle marked tasks that are not in the provided task list', () => {
      const task1 = createTask('task-1', 'Existing task');

      const tmsState = createDefaultTMSState({
        markedTasks: ['task-1', 'task-2'],
        markedOrder: ['task-1', 'task-2'],
      });

      const ordered = AF4Handler.getOrderedTasks([task1], tmsState);

      expect(ordered).toHaveLength(1);
      expect(ordered[0].id).toBe('task-1');
    });
  });

  describe('onTaskCreated', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'New task');
      const tmsState = createDefaultTMSState();

      const delta = AF4Handler.onTaskCreated(task, tmsState);
      expect(delta).toEqual({});
    });
  });

  describe('onTaskCompleted', () => {
    it('should remove mark from completed task', () => {
      const tmsState = createDefaultTMSState({
        markedTasks: ['task-1', 'task-2'],
        markedOrder: ['task-1', 'task-2'],
      });

      const task = createTask('task-1', 'Completed task');
      const delta = AF4Handler.onTaskCompleted(task, tmsState);

      expect(delta.af4).toBeDefined();
      expect(delta.af4!.markedTasks).not.toContain('task-1');
      expect(delta.af4!.markedOrder).not.toContain('task-1');
      expect(delta.af4!.markedTasks).toContain('task-2');
    });

    it('should handle completing unmarked task', () => {
      const tmsState = createDefaultTMSState({
        markedTasks: ['task-2'],
        markedOrder: ['task-2'],
      });

      const task = createTask('task-1', 'Unmarked task');
      const delta = AF4Handler.onTaskCompleted(task, tmsState);

      // No changes needed — empty delta
      expect(delta).toEqual({});
    });
  });
});
