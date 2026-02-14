import { describe, it, expect } from 'vitest';
import * as FVPHandler from './FVPHandler';
import { Task, TMSState, Priority, TimeManagementSystem } from '@/types';

const createDefaultTMSState = (overrides?: Partial<TMSState['fvp']>): TMSState => ({
  activeSystem: TimeManagementSystem.FVP,
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
    ...overrides,
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

describe('FVPHandler', () => {
  describe('initialize', () => {
    it('should not modify state', () => {
      const tmsState = createDefaultTMSState();
      const delta = FVPHandler.initialize([], tmsState);
      expect(delta).toEqual({});
    });
  });

  describe('getOrderedTasks', () => {
    it('should return dotted tasks in reverse order (last dotted first)', () => {
      const task1 = createTask('task-1', 'First dotted');
      const task2 = createTask('task-2', 'Second dotted');
      const task3 = createTask('task-3', 'Third dotted');
      const task4 = createTask('task-4', 'Undotted');

      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-1', 'task-2', 'task-3'],
      });

      const ordered = FVPHandler.getOrderedTasks([task1, task2, task3, task4], tmsState);

      expect(ordered).toHaveLength(4);
      expect(ordered[0].id).toBe('task-3');
      expect(ordered[1].id).toBe('task-2');
      expect(ordered[2].id).toBe('task-1');
      expect(ordered[3].id).toBe('task-4');
    });

    it('should return all tasks in natural order when no tasks are dotted', () => {
      const task1 = createTask('task-1', 'Task 1');
      const task2 = createTask('task-2', 'Task 2');
      const tmsState = createDefaultTMSState();

      const ordered = FVPHandler.getOrderedTasks([task1, task2], tmsState);

      expect(ordered).toHaveLength(2);
      expect(ordered).toEqual([task1, task2]);
    });

    it('should handle empty task list', () => {
      const tmsState = createDefaultTMSState();
      const ordered = FVPHandler.getOrderedTasks([], tmsState);
      expect(ordered).toEqual([]);
    });

    it('should handle dotted tasks that are not in the provided task list', () => {
      const task1 = createTask('task-1', 'Existing task');

      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-1', 'task-2', 'task-3'],
      });

      const ordered = FVPHandler.getOrderedTasks([task1], tmsState);

      expect(ordered).toHaveLength(1);
      expect(ordered[0].id).toBe('task-1');
    });

    it('should preserve reverse order even if tasks are provided in different order', () => {
      const task1 = createTask('task-1', 'Task 1');
      const task2 = createTask('task-2', 'Task 2');
      const task3 = createTask('task-3', 'Task 3');

      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-1', 'task-2', 'task-3'],
      });

      const ordered = FVPHandler.getOrderedTasks([task3, task1, task2], tmsState);

      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-3');
      expect(ordered[1].id).toBe('task-2');
      expect(ordered[2].id).toBe('task-1');
    });
  });

  describe('onTaskCreated', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'New task');
      const tmsState = createDefaultTMSState();

      const delta = FVPHandler.onTaskCreated(task, tmsState);
      expect(delta).toEqual({});
    });
  });

  describe('onTaskCompleted', () => {
    it('should remove dot from completed task', () => {
      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-1', 'task-2', 'task-3'],
      });

      const task = createTask('task-2', 'Completed task');
      const delta = FVPHandler.onTaskCompleted(task, tmsState);

      expect(delta.fvp).toBeDefined();
      expect(delta.fvp!.dottedTasks).not.toContain('task-2');
      expect(delta.fvp!.dottedTasks).toContain('task-1');
      expect(delta.fvp!.dottedTasks).toContain('task-3');
    });

    it('should reset currentX if completed task was X', () => {
      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-1', 'task-2'],
        currentX: 'task-2',
        selectionInProgress: true,
      });

      const task = createTask('task-2', 'Completed X task');
      const delta = FVPHandler.onTaskCompleted(task, tmsState);

      expect(delta.fvp).toBeDefined();
      expect(delta.fvp!.dottedTasks).not.toContain('task-2');
      expect(delta.fvp!.currentX).toBeNull();
      expect(delta.fvp!.selectionInProgress).toBe(false);
    });

    it('should not reset currentX if completed task was not X', () => {
      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-1', 'task-2'],
        currentX: 'task-2',
        selectionInProgress: true,
      });

      const task = createTask('task-1', 'Completed non-X task');
      const delta = FVPHandler.onTaskCompleted(task, tmsState);

      expect(delta.fvp).toBeDefined();
      expect(delta.fvp!.dottedTasks).not.toContain('task-1');
      // currentX and selectionInProgress should be preserved (not in delta or unchanged)
      const mergedFvp = { ...tmsState.fvp, ...delta.fvp };
      expect(mergedFvp.currentX).toBe('task-2');
      expect(mergedFvp.selectionInProgress).toBe(true);
    });

    it('should handle completing undotted task', () => {
      const tmsState = createDefaultTMSState({
        dottedTasks: ['task-2'],
      });

      const task = createTask('task-1', 'Undotted task');
      const delta = FVPHandler.onTaskCompleted(task, tmsState);

      // No changes needed — empty delta
      expect(delta).toEqual({});
    });
  });
});
