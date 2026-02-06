import { describe, it, expect, beforeEach } from 'vitest';
import { StandardHandler } from './StandardHandler';
import { useTMSStore } from '@/stores/tmsStore';
import { Task, Priority, TimeManagementSystem } from '@/types';

describe('StandardHandler', () => {
  let handler: StandardHandler;
  
  beforeEach(() => {
    handler = new StandardHandler();
    // Reset store
    useTMSStore.setState({
      state: {
        activeSystem: TimeManagementSystem.NONE,
        dit: {
          todayTasks: [],
          tomorrowTasks: [],
          lastDayChange: new Date().toISOString()
        },
        af4: {
          markedTasks: [],
          markedOrder: []
        },
        fvp: {
          dottedTasks: [],
          currentX: null,
          selectionInProgress: false
        }
      }
    });
  });
  
  const createTask = (id: string, description: string, order: number): Task => ({
    id,
    projectId: 'project-1',
    parentTaskId: null,
    sectionId: null,
    columnId: null,
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
    updatedAt: new Date().toISOString()
  });
  
  describe('initialize', () => {
    it('should not modify state', () => {
      const initialState = useTMSStore.getState().state;
      handler.initialize([]);
      const finalState = useTMSStore.getState().state;
      
      expect(finalState).toEqual(initialState);
    });
  });
  
  describe('getOrderedTasks', () => {
    it('should return tasks sorted by order field', () => {
      const task1 = createTask('task-1', 'Third task', 3);
      const task2 = createTask('task-2', 'First task', 1);
      const task3 = createTask('task-3', 'Second task', 2);
      
      const ordered = handler.getOrderedTasks([task1, task2, task3]);
      
      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-2');
      expect(ordered[1].id).toBe('task-3');
      expect(ordered[2].id).toBe('task-1');
    });
    
    it('should handle tasks with same order', () => {
      const task1 = createTask('task-1', 'Task 1', 1);
      const task2 = createTask('task-2', 'Task 2', 1);
      const task3 = createTask('task-3', 'Task 3', 2);
      
      const ordered = handler.getOrderedTasks([task1, task2, task3]);
      
      expect(ordered).toHaveLength(3);
      expect(ordered[2].id).toBe('task-3');
      // task-1 and task-2 should both be before task-3
      expect([ordered[0].id, ordered[1].id]).toContain('task-1');
      expect([ordered[0].id, ordered[1].id]).toContain('task-2');
    });
    
    it('should handle empty task list', () => {
      const ordered = handler.getOrderedTasks([]);
      expect(ordered).toEqual([]);
    });
    
    it('should handle single task', () => {
      const task = createTask('task-1', 'Only task', 1);
      const ordered = handler.getOrderedTasks([task]);
      
      expect(ordered).toHaveLength(1);
      expect(ordered[0]).toEqual(task);
    });
    
    it('should not mutate original array', () => {
      const task1 = createTask('task-1', 'Task 1', 2);
      const task2 = createTask('task-2', 'Task 2', 1);
      const original = [task1, task2];
      
      handler.getOrderedTasks(original);
      
      expect(original[0]).toBe(task1);
      expect(original[1]).toBe(task2);
    });
  });
  
  describe('onTaskCreated', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'New task', 1);
      const initialState = useTMSStore.getState().state;
      
      handler.onTaskCreated(task);
      
      const finalState = useTMSStore.getState().state;
      expect(finalState).toEqual(initialState);
    });
  });
  
  describe('onTaskCompleted', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'Completed task', 1);
      const initialState = useTMSStore.getState().state;
      
      handler.onTaskCompleted(task);
      
      const finalState = useTMSStore.getState().state;
      expect(finalState).toEqual(initialState);
    });
  });
});
