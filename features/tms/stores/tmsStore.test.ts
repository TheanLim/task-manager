import { describe, it, expect, beforeEach } from 'vitest';
import { useTMSStore } from './tmsStore';
import { TimeManagementSystem } from '@/types';

describe('useTMSStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useTMSStore.getState();
    store.clearSystemMetadata();
    store.setActiveSystem(TimeManagementSystem.NONE);
  });

  describe('setActiveSystem', () => {
    it('should set the active time management system', () => {
      const store = useTMSStore.getState();
      
      store.setActiveSystem(TimeManagementSystem.DIT);
      expect(useTMSStore.getState().state.activeSystem).toBe(TimeManagementSystem.DIT);
      
      store.setActiveSystem(TimeManagementSystem.AF4);
      expect(useTMSStore.getState().state.activeSystem).toBe(TimeManagementSystem.AF4);
    });
  });

  describe('DIT actions', () => {
    it('should add task to today list', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.addToToday(taskId);
      
      expect(useTMSStore.getState().state.dit.todayTasks).toContain(taskId);
    });

    it('should add task to tomorrow list', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.addToTomorrow(taskId);
      
      expect(useTMSStore.getState().state.dit.tomorrowTasks).toContain(taskId);
    });

    it('should move task from tomorrow to today', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.addToTomorrow(taskId);
      expect(useTMSStore.getState().state.dit.tomorrowTasks).toContain(taskId);
      
      store.moveToToday(taskId);
      
      const state = useTMSStore.getState().state.dit;
      expect(state.todayTasks).toContain(taskId);
      expect(state.tomorrowTasks).not.toContain(taskId);
    });

    it('should move task from today to tomorrow', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.addToToday(taskId);
      expect(useTMSStore.getState().state.dit.todayTasks).toContain(taskId);
      
      store.moveToTomorrow(taskId);
      
      const state = useTMSStore.getState().state.dit;
      expect(state.tomorrowTasks).toContain(taskId);
      expect(state.todayTasks).not.toContain(taskId);
    });

    it('should remove task from schedule (both today and tomorrow)', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      const task2 = 'task-2';
      
      store.addToToday(task1);
      store.addToTomorrow(task2);
      
      store.removeFromSchedule(task1);
      store.removeFromSchedule(task2);
      
      const state = useTMSStore.getState().state.dit;
      expect(state.todayTasks).not.toContain(task1);
      expect(state.tomorrowTasks).not.toContain(task2);
    });

    it('should perform day rollover', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      const task2 = 'task-2';
      
      store.addToTomorrow(task1);
      store.addToTomorrow(task2);
      
      store.performDayRollover();
      
      const state = useTMSStore.getState().state.dit;
      expect(state.todayTasks).toContain(task1);
      expect(state.todayTasks).toContain(task2);
      expect(state.tomorrowTasks).toHaveLength(0);
    });
  });

  describe('AF4 actions', () => {
    it('should mark a task', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.markTask(taskId);
      
      const state = useTMSStore.getState().state.af4;
      expect(state.markedTasks).toContain(taskId);
      expect(state.markedOrder).toContain(taskId);
    });

    it('should not duplicate marks', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.markTask(taskId);
      store.markTask(taskId);
      
      const state = useTMSStore.getState().state.af4;
      expect(state.markedTasks).toHaveLength(1);
      expect(state.markedOrder).toHaveLength(1);
    });

    it('should preserve marking order', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      const task2 = 'task-2';
      const task3 = 'task-3';
      
      store.markTask(task1);
      store.markTask(task2);
      store.markTask(task3);
      
      const state = useTMSStore.getState().state.af4;
      expect(state.markedOrder).toEqual([task1, task2, task3]);
    });

    it('should unmark a task', () => {
      const store = useTMSStore.getState();
      const taskId = 'task-1';
      
      store.markTask(taskId);
      expect(useTMSStore.getState().state.af4.markedTasks).toContain(taskId);
      
      store.unmarkTask(taskId);
      
      const state = useTMSStore.getState().state.af4;
      expect(state.markedTasks).not.toContain(taskId);
      expect(state.markedOrder).not.toContain(taskId);
    });
  });

  describe('FVP actions', () => {
    it('should start FVP selection', () => {
      const store = useTMSStore.getState();
      const firstTaskId = 'task-1';
      
      store.startFVPSelection(firstTaskId);
      
      const state = useTMSStore.getState().state.fvp;
      expect(state.currentX).toBe(firstTaskId);
      expect(state.selectionInProgress).toBe(true);
      expect(state.dottedTasks).toHaveLength(0);
    });

    it('should select FVP task (dot it)', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      const task2 = 'task-2';
      
      store.startFVPSelection(task1);
      store.selectFVPTask(task2);
      
      const state = useTMSStore.getState().state.fvp;
      expect(state.dottedTasks).toContain(task2);
      expect(state.currentX).toBe(task2);
    });

    it('should not duplicate dotted tasks', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      const task2 = 'task-2';
      
      store.startFVPSelection(task1);
      store.selectFVPTask(task2);
      store.selectFVPTask(task2);
      
      const state = useTMSStore.getState().state.fvp;
      expect(state.dottedTasks).toHaveLength(1);
    });

    it('should skip FVP task without state change', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      
      store.startFVPSelection(task1);
      const stateBefore = useTMSStore.getState().state.fvp;
      
      store.skipFVPTask();
      
      const stateAfter = useTMSStore.getState().state.fvp;
      expect(stateAfter).toEqual(stateBefore);
    });

    it('should end FVP selection', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      
      store.startFVPSelection(task1);
      store.endFVPSelection();
      
      const state = useTMSStore.getState().state.fvp;
      expect(state.selectionInProgress).toBe(false);
      expect(state.currentX).toBe(null);
    });

    it('should reset FVP state', () => {
      const store = useTMSStore.getState();
      const task1 = 'task-1';
      const task2 = 'task-2';
      
      store.startFVPSelection(task1);
      store.selectFVPTask(task2);
      
      store.resetFVP();
      
      const state = useTMSStore.getState().state.fvp;
      expect(state.dottedTasks).toHaveLength(0);
      expect(state.currentX).toBe(null);
      expect(state.selectionInProgress).toBe(false);
    });
  });

  describe('clearSystemMetadata', () => {
    it('should clear all TMS metadata', () => {
      const store = useTMSStore.getState();
      
      // Set up some state
      store.addToToday('task-1');
      store.addToTomorrow('task-2');
      store.markTask('task-3');
      store.startFVPSelection('task-4');
      store.selectFVPTask('task-5');
      
      // Clear metadata
      store.clearSystemMetadata();
      
      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).toHaveLength(0);
      expect(state.dit.tomorrowTasks).toHaveLength(0);
      expect(state.af4.markedTasks).toHaveLength(0);
      expect(state.af4.markedOrder).toHaveLength(0);
      expect(state.fvp.dottedTasks).toHaveLength(0);
      expect(state.fvp.currentX).toBe(null);
      expect(state.fvp.selectionInProgress).toBe(false);
    });
  });

  describe('initial state', () => {
    it('should have correct default state', () => {
      // Create a fresh store instance by clearing and checking
      const store = useTMSStore.getState();
      store.clearSystemMetadata();
      store.setActiveSystem(TimeManagementSystem.NONE);
      
      const state = useTMSStore.getState().state;
      
      expect(state.activeSystem).toBe(TimeManagementSystem.NONE);
      expect(state.dit.todayTasks).toEqual([]);
      expect(state.dit.tomorrowTasks).toEqual([]);
      expect(state.dit.lastDayChange).toBeDefined();
      expect(state.af4.markedTasks).toEqual([]);
      expect(state.af4.markedOrder).toEqual([]);
      expect(state.fvp.dottedTasks).toEqual([]);
      expect(state.fvp.currentX).toBe(null);
      expect(state.fvp.selectionInProgress).toBe(false);
    });
  });
});
