import { describe, it, expect, beforeEach } from 'vitest';
import { AF4Handler } from './AF4Handler';
import { useTMSStore } from '@/stores/tmsStore';
import { Task, Priority, TimeManagementSystem } from '@/types';

describe('AF4Handler', () => {
  let handler: AF4Handler;
  
  beforeEach(() => {
    handler = new AF4Handler();
    // Reset store
    useTMSStore.setState({
      state: {
        activeSystem: TimeManagementSystem.AF4,
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
    it('should return marked tasks first in marked order', () => {
      const task1 = createTask('task-1', 'First marked');
      const task2 = createTask('task-2', 'Second marked');
      const task3 = createTask('task-3', 'Unmarked');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          af4: {
            markedTasks: ['task-1', 'task-2'],
            markedOrder: ['task-1', 'task-2']
          }
        }
      });
      
      const ordered = handler.getOrderedTasks([task1, task2, task3]);
      
      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-1');
      expect(ordered[1].id).toBe('task-2');
      expect(ordered[2].id).toBe('task-3');
    });
    
    it('should preserve marked order even if tasks are provided in different order', () => {
      const task1 = createTask('task-1', 'Second marked');
      const task2 = createTask('task-2', 'First marked');
      const task3 = createTask('task-3', 'Third marked');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          af4: {
            markedTasks: ['task-2', 'task-1', 'task-3'],
            markedOrder: ['task-2', 'task-1', 'task-3']
          }
        }
      });
      
      // Provide tasks in different order
      const ordered = handler.getOrderedTasks([task1, task2, task3]);
      
      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-2');
      expect(ordered[1].id).toBe('task-1');
      expect(ordered[2].id).toBe('task-3');
    });
    
    it('should return all unmarked tasks when no tasks are marked', () => {
      const task1 = createTask('task-1', 'Task 1');
      const task2 = createTask('task-2', 'Task 2');
      
      const ordered = handler.getOrderedTasks([task1, task2]);
      
      expect(ordered).toHaveLength(2);
      expect(ordered).toContainEqual(task1);
      expect(ordered).toContainEqual(task2);
    });
    
    it('should handle empty task list', () => {
      const ordered = handler.getOrderedTasks([]);
      expect(ordered).toEqual([]);
    });
    
    it('should handle marked tasks that are not in the provided task list', () => {
      const task1 = createTask('task-1', 'Existing task');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          af4: {
            markedTasks: ['task-1', 'task-2'],
            markedOrder: ['task-1', 'task-2']
          }
        }
      });
      
      const ordered = handler.getOrderedTasks([task1]);
      
      expect(ordered).toHaveLength(1);
      expect(ordered[0].id).toBe('task-1');
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
    it('should remove mark from completed task', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          af4: {
            markedTasks: ['task-1', 'task-2'],
            markedOrder: ['task-1', 'task-2']
          }
        }
      });
      
      const task = createTask('task-1', 'Completed task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.af4.markedTasks).not.toContain('task-1');
      expect(state.af4.markedOrder).not.toContain('task-1');
      expect(state.af4.markedTasks).toContain('task-2');
    });
    
    it('should handle completing unmarked task', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          af4: {
            markedTasks: ['task-2'],
            markedOrder: ['task-2']
          }
        }
      });
      
      const task = createTask('task-1', 'Unmarked task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.af4.markedTasks).toEqual(['task-2']);
      expect(state.af4.markedOrder).toEqual(['task-2']);
    });
  });
});
