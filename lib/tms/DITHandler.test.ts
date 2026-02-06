import { describe, it, expect, beforeEach } from 'vitest';
import { DITHandler } from './DITHandler';
import { useTMSStore } from '@/stores/tmsStore';
import { Task, Priority, TimeManagementSystem } from '@/types';

describe('DITHandler', () => {
  let handler: DITHandler;
  
  beforeEach(() => {
    handler = new DITHandler();
    // Reset store
    useTMSStore.setState({
      state: {
        activeSystem: TimeManagementSystem.DIT,
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
    it('should perform day rollover if day has changed', () => {
      // Set last day change to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-1'],
            tomorrowTasks: ['task-2', 'task-3'],
            lastDayChange: yesterday.toISOString()
          }
        }
      });
      
      handler.initialize([]);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).toEqual(['task-2', 'task-3']);
      expect(state.dit.tomorrowTasks).toEqual([]);
    });
    
    it('should not perform rollover if day has not changed', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-1'],
            tomorrowTasks: ['task-2'],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      handler.initialize([]);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).toEqual(['task-1']);
      expect(state.dit.tomorrowTasks).toEqual(['task-2']);
    });
  });
  
  describe('getOrderedTasks', () => {
    it('should return today tasks first, then tomorrow tasks', () => {
      const task1 = createTask('task-1', 'Today task');
      const task2 = createTask('task-2', 'Tomorrow task');
      const task3 = createTask('task-3', 'Another today task');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-1', 'task-3'],
            tomorrowTasks: ['task-2'],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      const ordered = handler.getOrderedTasks([task1, task2, task3]);
      
      expect(ordered).toHaveLength(3);
      expect(ordered[0].id).toBe('task-1');
      expect(ordered[1].id).toBe('task-3');
      expect(ordered[2].id).toBe('task-2');
    });
    
    it('should include tasks not in DIT lists at the end', () => {
      const task1 = createTask('task-1', 'Today task');
      const task2 = createTask('task-2', 'Untracked task');
      
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-1'],
            tomorrowTasks: [],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      const ordered = handler.getOrderedTasks([task1, task2]);
      
      expect(ordered).toHaveLength(2);
      expect(ordered[0].id).toBe('task-1');
      expect(ordered[1].id).toBe('task-2');
    });
    
    it('should return empty array for empty task list', () => {
      const ordered = handler.getOrderedTasks([]);
      expect(ordered).toEqual([]);
    });
  });
  
  describe('onTaskCreated', () => {
    it('should add new task to tomorrow list', () => {
      const task = createTask('task-1', 'New task');
      
      handler.onTaskCreated(task);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.tomorrowTasks).toContain('task-1');
    });
    
    it('should not duplicate task in tomorrow list', () => {
      const task = createTask('task-1', 'New task');
      
      handler.onTaskCreated(task);
      handler.onTaskCreated(task);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.tomorrowTasks.filter(id => id === 'task-1')).toHaveLength(2);
    });
  });
  
  describe('onTaskCompleted', () => {
    it('should remove task from today list', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-1', 'task-2'],
            tomorrowTasks: [],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      const task = createTask('task-1', 'Completed task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).not.toContain('task-1');
      expect(state.dit.todayTasks).toContain('task-2');
    });
    
    it('should remove task from tomorrow list', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: [],
            tomorrowTasks: ['task-1', 'task-2'],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      const task = createTask('task-1', 'Completed task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.tomorrowTasks).not.toContain('task-1');
      expect(state.dit.tomorrowTasks).toContain('task-2');
    });
    
    it('should handle completing task not in any list', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-2'],
            tomorrowTasks: ['task-3'],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      const task = createTask('task-1', 'Untracked task');
      handler.onTaskCompleted(task);
      
      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).toEqual(['task-2']);
      expect(state.dit.tomorrowTasks).toEqual(['task-3']);
    });
  });
  
  describe('onDayChange', () => {
    it('should perform day rollover', () => {
      useTMSStore.setState({
        state: {
          ...useTMSStore.getState().state,
          dit: {
            todayTasks: ['task-1'],
            tomorrowTasks: ['task-2', 'task-3'],
            lastDayChange: new Date().toISOString()
          }
        }
      });
      
      handler.onDayChange();
      
      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).toEqual(['task-2', 'task-3']);
      expect(state.dit.tomorrowTasks).toEqual([]);
    });
  });
});
