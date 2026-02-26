import { describe, it, expect, beforeEach } from 'vitest';
import { useTMSStore } from './tmsStore';
import { TimeManagementSystem } from '@/types';

describe('useTMSStore', () => {
  beforeEach(() => {
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
      useTMSStore.getState().addToToday('task-1');
      expect(useTMSStore.getState().state.dit.todayTasks).toContain('task-1');
    });

    it('should add task to tomorrow list', () => {
      useTMSStore.getState().addToTomorrow('task-1');
      expect(useTMSStore.getState().state.dit.tomorrowTasks).toContain('task-1');
    });

    it('should move task from tomorrow to today', () => {
      const store = useTMSStore.getState();
      store.addToTomorrow('task-1');
      store.moveToToday('task-1');
      const dit = useTMSStore.getState().state.dit;
      expect(dit.todayTasks).toContain('task-1');
      expect(dit.tomorrowTasks).not.toContain('task-1');
    });

    it('should move task from today to tomorrow', () => {
      const store = useTMSStore.getState();
      store.addToToday('task-1');
      store.moveToTomorrow('task-1');
      const dit = useTMSStore.getState().state.dit;
      expect(dit.tomorrowTasks).toContain('task-1');
      expect(dit.todayTasks).not.toContain('task-1');
    });

    it('should remove task from schedule', () => {
      const store = useTMSStore.getState();
      store.addToToday('task-1');
      store.addToTomorrow('task-2');
      store.removeFromSchedule('task-1');
      store.removeFromSchedule('task-2');
      const dit = useTMSStore.getState().state.dit;
      expect(dit.todayTasks).not.toContain('task-1');
      expect(dit.tomorrowTasks).not.toContain('task-2');
    });

    it('should perform day rollover', () => {
      const store = useTMSStore.getState();
      store.addToTomorrow('task-1');
      store.addToTomorrow('task-2');
      store.performDayRollover();
      const dit = useTMSStore.getState().state.dit;
      expect(dit.todayTasks).toContain('task-1');
      expect(dit.todayTasks).toContain('task-2');
      expect(dit.tomorrowTasks).toHaveLength(0);
    });
  });

  describe('AF4 state via updateState', () => {
    it('should update af4 backlog via updateState', () => {
      useTMSStore.getState().updateState({
        af4: {
          backlogTaskIds: ['task-1', 'task-2'],
          activeListTaskIds: [],
          currentPosition: 0,
          lastPassHadWork: false,
          passStartPosition: 0,
          dismissedTaskIds: [],
          phase: 'backlog',
        },
      });
      const af4 = useTMSStore.getState().state.af4;
      expect(af4.backlogTaskIds).toEqual(['task-1', 'task-2']);
      expect(af4.activeListTaskIds).toEqual([]);
    });

    it('should update af4 phase to active via updateState', () => {
      useTMSStore.getState().updateState({
        af4: {
          backlogTaskIds: ['task-1'],
          activeListTaskIds: ['task-2'],
          currentPosition: 0,
          lastPassHadWork: false,
          passStartPosition: 0,
          dismissedTaskIds: [],
          phase: 'active',
        },
      });
      expect(useTMSStore.getState().state.af4.phase).toBe('active');
    });
  });

  describe('FVP state via updateState', () => {
    it('should update fvp dottedTasks via updateState', () => {
      useTMSStore.getState().updateState({
        fvp: { dottedTasks: ['task-1', 'task-2'], scanPosition: 2 },
      });
      const fvp = useTMSStore.getState().state.fvp;
      expect(fvp.dottedTasks).toEqual(['task-1', 'task-2']);
      expect(fvp.scanPosition).toBe(2);
    });

    it('should reset fvp via updateState', () => {
      useTMSStore.getState().updateState({
        fvp: { dottedTasks: ['task-1'], scanPosition: 3 },
      });
      useTMSStore.getState().updateState({
        fvp: { dottedTasks: [], scanPosition: 1 },
      });
      const fvp = useTMSStore.getState().state.fvp;
      expect(fvp.dottedTasks).toHaveLength(0);
      expect(fvp.scanPosition).toBe(1);
    });
  });

  describe('clearSystemMetadata', () => {
    it('should reset all TMS sub-state to defaults', () => {
      const store = useTMSStore.getState();
      store.addToToday('task-1');
      store.addToTomorrow('task-2');
      store.updateState({
        af4: {
          backlogTaskIds: ['task-3'],
          activeListTaskIds: ['task-4'],
          currentPosition: 1,
          lastPassHadWork: true,
          passStartPosition: 0,
          dismissedTaskIds: ['task-3'],
          phase: 'active',
        },
        fvp: { dottedTasks: ['task-5'], scanPosition: 3 },
      });

      store.clearSystemMetadata();

      const state = useTMSStore.getState().state;
      expect(state.dit.todayTasks).toHaveLength(0);
      expect(state.dit.tomorrowTasks).toHaveLength(0);
      expect(state.af4.backlogTaskIds).toHaveLength(0);
      expect(state.af4.activeListTaskIds).toHaveLength(0);
      expect(state.af4.currentPosition).toBe(0);
      expect(state.af4.phase).toBe('backlog');
      expect(state.fvp.dottedTasks).toHaveLength(0);
      expect(state.fvp.scanPosition).toBe(1);
    });
  });

  describe('initial state', () => {
    it('should have correct default state after clear', () => {
      const store = useTMSStore.getState();
      store.clearSystemMetadata();
      store.setActiveSystem(TimeManagementSystem.NONE);

      const state = useTMSStore.getState().state;
      expect(state.activeSystem).toBe(TimeManagementSystem.NONE);
      expect(state.dit.todayTasks).toEqual([]);
      expect(state.dit.tomorrowTasks).toEqual([]);
      expect(state.dit.lastDayChange).toBeDefined();
      expect(state.af4.backlogTaskIds).toEqual([]);
      expect(state.af4.activeListTaskIds).toEqual([]);
      expect(state.af4.currentPosition).toBe(0);
      expect(state.af4.phase).toBe('backlog');
      expect(state.fvp.dottedTasks).toEqual([]);
      expect(state.fvp.scanPosition).toBe(1);
    });
  });
});
