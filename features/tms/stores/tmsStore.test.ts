import { describe, it, expect, beforeEach } from 'vitest';
import { useTMSStore, migrateTMSState } from './tmsStore';

describe('useTMSStore', () => {
  beforeEach(() => {
    // Reset to clean default state before each test
    useTMSStore.setState({
      state: {
        activeSystem: 'none',
        systemStates: {},
        systemStateVersions: {},
      },
    });
  });

  // ─── setActiveSystem ────────────────────────────────────────────────────────

  describe('setActiveSystem', () => {
    it('updates activeSystem', () => {
      useTMSStore.getState().setActiveSystem('dit');
      expect(useTMSStore.getState().state.activeSystem).toBe('dit');
    });

    it('does not affect systemStates', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { dottedTasks: ['t1'] });
      useTMSStore.getState().setActiveSystem('af4');
      expect((useTMSStore.getState().state.systemStates['fvp'] as any).dottedTasks).toEqual(['t1']);
    });
  });

  // ─── applySystemStateDelta ──────────────────────────────────────────────────

  describe('applySystemStateDelta', () => {
    it('shallow-merges delta into systemStates[id], creating key if absent', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { dottedTasks: ['t1'], scanPosition: 2 });
      const fvp = useTMSStore.getState().state.systemStates['fvp'] as any;
      expect(fvp.dottedTasks).toEqual(['t1']);
      expect(fvp.scanPosition).toBe(2);
    });

    it('preserves existing keys not in delta', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { dottedTasks: ['t1'], scanPosition: 1 });
      useTMSStore.getState().applySystemStateDelta('fvp', { scanPosition: 3 });
      const fvp = useTMSStore.getState().state.systemStates['fvp'] as any;
      expect(fvp.dottedTasks).toEqual(['t1']); // preserved
      expect(fvp.scanPosition).toBe(3);        // updated
    });

    it('updates systemStateVersions when newVersion is provided', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { scanPosition: 1 }, 2);
      expect(useTMSStore.getState().state.systemStateVersions['fvp']).toBe(2);
    });

    it('does not touch systemStateVersions when newVersion is omitted', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { scanPosition: 1 });
      expect(useTMSStore.getState().state.systemStateVersions['fvp']).toBeUndefined();
    });

    it('does not affect other system states', () => {
      useTMSStore.getState().applySystemStateDelta('af4', { currentPosition: 5 });
      useTMSStore.getState().applySystemStateDelta('fvp', { scanPosition: 2 });
      expect((useTMSStore.getState().state.systemStates['af4'] as any).currentPosition).toBe(5);
    });
  });

  // ─── setSystemState ─────────────────────────────────────────────────────────

  describe('setSystemState', () => {
    it('replaces the entire slice for the given id', () => {
      useTMSStore.getState().applySystemStateDelta('dit', { todayTasks: ['t1'], tomorrowTasks: [] });
      useTMSStore.getState().setSystemState('dit', { todayTasks: [], tomorrowTasks: ['t2'], lastDayChange: 'x' });
      const dit = useTMSStore.getState().state.systemStates['dit'] as any;
      expect(dit.todayTasks).toEqual([]);
      expect(dit.tomorrowTasks).toEqual(['t2']);
    });

    it('sets version when provided', () => {
      useTMSStore.getState().setSystemState('dit', {}, 3);
      expect(useTMSStore.getState().state.systemStateVersions['dit']).toBe(3);
    });

    it('does not affect other system states', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { scanPosition: 7 });
      useTMSStore.getState().setSystemState('dit', { todayTasks: [] });
      expect((useTMSStore.getState().state.systemStates['fvp'] as any).scanPosition).toBe(7);
    });
  });

  // ─── clearSystemState ───────────────────────────────────────────────────────

  describe('clearSystemState', () => {
    it('removes the key from systemStates', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', { dottedTasks: ['t1'] });
      useTMSStore.getState().clearSystemState('fvp');
      expect(useTMSStore.getState().state.systemStates['fvp']).toBeUndefined();
    });

    it('removes the key from systemStateVersions', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', {}, 2);
      useTMSStore.getState().clearSystemState('fvp');
      expect(useTMSStore.getState().state.systemStateVersions['fvp']).toBeUndefined();
    });

    it('does not affect other system states', () => {
      useTMSStore.getState().applySystemStateDelta('af4', { currentPosition: 1 });
      useTMSStore.getState().applySystemStateDelta('fvp', { scanPosition: 2 });
      useTMSStore.getState().clearSystemState('fvp');
      expect((useTMSStore.getState().state.systemStates['af4'] as any).currentPosition).toBe(1);
    });

    it('is a no-op when key does not exist', () => {
      expect(() => useTMSStore.getState().clearSystemState('nonexistent')).not.toThrow();
    });
  });

  // ─── systemStateVersions tracking ──────────────────────────────────────────

  describe('systemStateVersions tracking', () => {
    it('starts empty', () => {
      expect(useTMSStore.getState().state.systemStateVersions).toEqual({});
    });

    it('is updated by applySystemStateDelta with version', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', {}, 1);
      useTMSStore.getState().applySystemStateDelta('af4', {}, 2);
      expect(useTMSStore.getState().state.systemStateVersions).toEqual({ fvp: 1, af4: 2 });
    });

    it('is cleared by clearSystemState', () => {
      useTMSStore.getState().applySystemStateDelta('fvp', {}, 1);
      useTMSStore.getState().clearSystemState('fvp');
      expect(useTMSStore.getState().state.systemStateVersions['fvp']).toBeUndefined();
    });
  });
});

// ─── migrateTMSState — v1 → v2 ─────────────────────────────────────────────

describe('migrateTMSState', () => {
  // Validates: Requirements 2.2

  const v1DIT = { todayTasks: ['t1'], tomorrowTasks: ['t2'], lastDayChange: '2024-01-01T00:00:00.000Z' };
  const v1AF4 = {
    backlogTaskIds: ['t3'],
    activeListTaskIds: ['t4'],
    currentPosition: 0,
    lastPassHadWork: false,
    passStartPosition: 0,
    dismissedTaskIds: [],
    phase: 'backlog',
  };
  const v1FVP = { dottedTasks: ['t5'], scanPosition: 1 };

  it('v1 with all three systems populated: lifts dit/af4/fvp into systemStates, sets versions to 1', () => {
    const persistedState = {
      activeSystem: 'dit',
      dit: v1DIT,
      af4: v1AF4,
      fvp: v1FVP,
    };
    const result = migrateTMSState(persistedState, 1);
    expect(result.activeSystem).toBe('dit');
    expect(result.systemStates).toHaveProperty('dit');
    expect(result.systemStates).toHaveProperty('af4');
    expect(result.systemStates).toHaveProperty('fvp');
    expect(result.systemStateVersions).toEqual({ dit: 1, af4: 1, fvp: 1 });
  });

  it('v1 with only dit populated: only dit key appears in systemStates', () => {
    const persistedState = {
      activeSystem: 'dit',
      dit: v1DIT,
      af4: null,
      fvp: undefined,
    };
    const result = migrateTMSState(persistedState, 1);
    expect(result.systemStates).toHaveProperty('dit');
    expect(result.systemStates).not.toHaveProperty('af4');
    expect(result.systemStates).not.toHaveProperty('fvp');
    expect(result.systemStateVersions).toEqual({ dit: 1 });
  });

  it('v1 with activeSystem none: activeSystem is none, systemStates is {}', () => {
    const persistedState = {
      activeSystem: 'none',
      dit: null,
      af4: null,
      fvp: null,
    };
    const result = migrateTMSState(persistedState, 1);
    expect(result.activeSystem).toBe('none');
    expect(result.systemStates).toEqual({});
    expect(result.systemStateVersions).toEqual({});
  });

  it('null/missing persisted state: returns safe default without crashing', () => {
    const result = migrateTMSState(null, 1);
    expect(result).toEqual({ activeSystem: 'none', systemStates: {}, systemStateVersions: {} });
  });

  it('unknown version number: returns safe default', () => {
    const result = migrateTMSState({ activeSystem: 'dit', dit: v1DIT }, 99);
    expect(result).toEqual({ activeSystem: 'none', systemStates: {}, systemStateVersions: {} });
  });

  it('v1 AF4 state: passStartPosition is NOT present in the migrated systemStates.af4', () => {
    const persistedState = {
      activeSystem: 'af4',
      dit: null,
      af4: v1AF4,
      fvp: null,
    };
    const result = migrateTMSState(persistedState, 1);
    const migratedAF4 = result.systemStates['af4'] as Record<string, unknown>;
    expect(migratedAF4).toBeDefined();
    expect(migratedAF4).not.toHaveProperty('passStartPosition');
  });
});
