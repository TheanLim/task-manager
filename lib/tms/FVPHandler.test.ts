import { describe, it, expect, beforeEach } from 'vitest';
import { FVPHandler } from './FVPHandler';
import { useTMSStore } from '@/stores/tmsStore';
import { Task, Priority, TimeManagementSystem } from '@/types';

describe('FVPHandler', () => {
  let handler: FVPHandler;
  
  beforeEach(() => {
    handler = new FVPHandler();
    // Reset store
    useTMSStore.setState({
      state: {
        activeSystem: TimeManagementSystem.FVP,
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
  
  const createTask = (id: string, description: string): Task => ({
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
    order: 0,
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
    it('should return dotted tasks in reverse order (last dotted first)', () => {
      const task1 = createTask('task-1', 'First dotted');
      const task2 = createTask('task-2', 'Second dotted');
      const task3 = createTask('task-3', 'Third dotted');
      const task4 = createTask('task-4', 'Undotted');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-1', 'task-2', 'task-3'],
            currentX: null,
            selectionInProgress: false
          }
        }
      });
      
      const ordered = handler.getOrderedTasks([task1, task2, task3, task4]);
      
      expect(ordered).toHaveLength(4);
      // Last dotted (task-3) should be first
      expect(ordered[0].id).toBe('task-3');
      expect(ordered[1].id).toBe('task-2');
      expect(ordered[2].id).toBe('task-1');
      expect(ordered[3].id).toBe('task-4');
    });
    
    it('should return all tasks in natural order when no tasks are dotted', () => {
      const task1 = createTask('task-1', 'Task 1');
      const task2 = createTask('task-2', 'Task 2');
      
      const ordered = handler.getOrderedTasks([task1, task2]);
      
      expect(ordered).toHaveLength(2);
      expect(ordered).toEqual([task1, task2]);
    });
    
    it('should handle empty task list', () => {
      const ordered = handler.getOrderedTasks([]);
      expect(ordered).toEqual([]);
    });
    
    it('should handle dotted tasks that are not in the provided task list', () => {
      const task1 = createTask('task-1', 'Existing task');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-1', 'task-2', 'task-3'],
            currentX: null,
            selectionInProgress: false
          }
        }
      });
      
      const ordered = handler.getOrderedTasks([task1]);
      
      expect(ordered).toHaveLength(1);
      expect(ordered[0].id).toBe('task-1');
    });
    
    it('should preserve reverse order even if tasks are provided in different order', () => {
      const task1 = createTask('task-1', 'Task 1');
      const task2 = createTask('task-2', 'Task 2');
      const task3 = createTask('task-3', 'Task 3');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-1', 'task-2', 'task-3'],
            currentX: null,
            selectionInProgress: false
          }
        }
      });
      
      // Provide tasks in different order
      const ordered = handler.getOrderedTasks([task3, task1, task2]);
      
      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-3');
      expect(ordered[1].id).toBe('task-2');
      expect(ordered[2].id).toBe('task-1');
    });
  });
  
  describe('onTaskCreated', () => {
    it('should not modify state', () => {
      const task = createTask('task-1', 'New task');
      const initialState = useTMSStore.getState().state;
      
      handler.onTaskCreated(task);
      
      const finalState = useTMSStore.getState().state;
      expect(finalState).toEqual(initialState);
    });
  });
  
  describe('onTaskCompleted', () => {
    it('should remove dot from completed task', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-1', 'task-2', 'task-3'],
            currentX: null,
            selectionInProgress: false
          }
        }
      });
      
      const task = createTask('task-2', 'Completed task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.fvp.dottedTasks).not.toContain('task-2');
      expect(state.fvp.dottedTasks).toContain('task-1');
      expect(state.fvp.dottedTasks).toContain('task-3');
    });
    
    it('should reset currentX if completed task was X', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-1', 'task-2'],
            currentX: 'task-2',
            selectionInProgress: true
          }
        }
      });
      
      const task = createTask('task-2', 'Completed X task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.fvp.dottedTasks).not.toContain('task-2');
      expect(state.fvp.currentX).toBeNull();
      expect(state.fvp.selectionInProgress).toBe(false);
    });
    
    it('should not reset currentX if completed task was not X', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-1', 'task-2'],
            currentX: 'task-2',
            selectionInProgress: true
          }
        }
      });
      
      const task = createTask('task-1', 'Completed non-X task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.fvp.dottedTasks).not.toContain('task-1');
      expect(state.fvp.currentX).toBe('task-2');
      expect(state.fvp.selectionInProgress).toBe(true);
    });
    
    it('should handle completing undotted task', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          fvp: {
            dottedTasks: ['task-2'],
            currentX: null,
            selectionInProgress: false
          }
        }
      });
      
      const task = createTask('task-1', 'Undotted task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.fvp.dottedTasks).toEqual(['task-2']);
    });
  });
});
