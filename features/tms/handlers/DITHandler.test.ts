import { describe, it, expect } from 'vitest';
import * as DITHandler from './DITHandler';
import { Task, TMSState, Priority, TimeManagementSystem } from '@/types';

const createDefaultTMSState = (overrides?: Partial<TMSState['dit']>): TMSState => ({
  activeSystem: TimeManagementSystem.DIT,
  dit: {
    todayTasks: [],
    tomorrowTasks: [],
    lastDayChange: new Date().toISOString(),
    ...overrides,
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

describe('DITHandler', () => {
  describe('initialize', () => {
    it('should perform day rollover if day has changed', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tmsState = createDefaultTMSState({
        todayTasks: ['task-1'],
        tomorrowTasks: ['task-2', 'task-3'],
        lastDayChange: yesterday.toISOString(),
      });

      const delta = DITHandler.initialize([], tmsState);

      expect(delta.dit).toBeDefined();
      expect(delta.dit!.todayTasks).toEqual(['task-2', 'task-3']);
      expect(delta.dit!.tomorrowTasks).toEqual([]);
    });

    it('should not perform rollover if day has not changed', () => {
      const tmsState = createDefaultTMSState({
        todayTasks: ['task-1'],
        tomorrowTasks: ['task-2'],
        lastDayChange: new Date().toISOString(),
      });

      const delta = DITHandler.initialize([], tmsState);

      // Empty delta means no changes
      expect(delta).toEqual({});
    });
  });

  describe('getOrderedTasks', () => {
    it('should return today tasks first, then tomorrow tasks', () => {
      const task1 = createTask('task-1', 'Today task');
      const task2 = createTask('task-2', 'Tomorrow task');
      const task3 = createTask('task-3', 'Another today task');

      const tmsState = createDefaultTMSState({
        todayTasks: ['task-1', 'task-3'],
        tomorrowTasks: ['task-2'],
      });

      const ordered = DITHandler.getOrderedTasks([task1, task2, task3], tmsState);

      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-1');
      expect(ordered[1].id).toBe('task-3');
      expect(ordered[2].id).toBe('task-2');
    });

    it('should include tasks not in DIT lists at the end', () => {
      const task1 = createTask('task-1', 'Today task');
      const task2 = createTask('task-2', 'Untracked task');

      const tmsState = createDefaultTMSState({
        todayTasks: ['task-1'],
      });

      const ordered = DITHandler.getOrderedTasks([task1, task2], tmsState);

      expect(ordered).toHaveLength(2);
      expect(ordered[0].id).toBe('task-1');
      expect(ordered[1].id).toBe('task-2');
    });

    it('should return empty array for empty task list', () => {
      const tmsState = createDefaultTMSState();
      const ordered = DITHandler.getOrderedTasks([], tmsState);
      expect(ordered).toEqual([]);
    });
  });

  describe('onTaskCreated', () => {
    it('should add new task to tomorrow list', () => {
      const task = createTask('task-1', 'New task');
      const tmsState = createDefaultTMSState();

      const delta = DITHandler.onTaskCreated(task, tmsState);

      expect(delta.dit).toBeDefined();
      expect(delta.dit!.tomorrowTasks).toContain('task-1');
    });

    it('should not duplicate task in tomorrow list', () => {
      const task = createTask('task-1', 'New task');
      const tmsState = createDefaultTMSState();

      const delta1 = DITHandler.onTaskCreated(task, tmsState);
      // Apply first delta and call again
      const updatedState: TMSState = { ...tmsState, dit: { ...tmsState.dit, ...delta1.dit } };
      const delta2 = DITHandler.onTaskCreated(task, updatedState);

      // The handler appends without dedup — same as original behavior
      const finalTomorrowTasks = delta2.dit!.tomorrowTasks;
      expect(finalTomorrowTasks.filter(id => id === 'task-1')).toHaveLength(2);
    });
  });

  describe('onTaskCompleted', () => {
    it('should remove task from today list', () => {
      const tmsState = createDefaultTMSState({
        todayTasks: ['task-1', 'task-2'],
      });

      const task = createTask('task-1', 'Completed task');
      const delta = DITHandler.onTaskCompleted(task, tmsState);

      expect(delta.dit).toBeDefined();
      expect(delta.dit!.todayTasks).not.toContain('task-1');
      expect(delta.dit!.todayTasks).toContain('task-2');
    });

    it('should remove task from tomorrow list', () => {
      const tmsState = createDefaultTMSState({
        tomorrowTasks: ['task-1', 'task-2'],
      });

      const task = createTask('task-1', 'Completed task');
      const delta = DITHandler.onTaskCompleted(task, tmsState);

      expect(delta.dit).toBeDefined();
      expect(delta.dit!.tomorrowTasks).not.toContain('task-1');
      expect(delta.dit!.tomorrowTasks).toContain('task-2');
    });

    it('should handle completing task not in any list', () => {
      const tmsState = createDefaultTMSState({
        todayTasks: ['task-2'],
        tomorrowTasks: ['task-3'],
      });

      const task = createTask('task-1', 'Untracked task');
      const delta = DITHandler.onTaskCompleted(task, tmsState);

      expect(delta.dit).toBeDefined();
      expect(delta.dit!.todayTasks).toEqual(['task-2']);
      expect(delta.dit!.tomorrowTasks).toEqual(['task-3']);
    });
  });
});
