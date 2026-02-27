/**
 * tmsSwitchService unit tests
 *
 * Uses a local handler registry (no global registry / no store imports).
 * Validates: tasks.md T-00a
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTMSSwitch, HandlerLookup, SystemState, TMSSystemId } from './tmsSwitchService';
import { TimeManagementSystemHandler } from '../handlers';
import { Task } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(id: string): Task {
  return {
    id,
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    description: `Task ${id}`,
    notes: '',
    assignee: '',
    priority: 'none',
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeHandler(
  id: string,
  overrides: Partial<TimeManagementSystemHandler> = {},
): TimeManagementSystemHandler {
  return {
    id,
    displayName: id.toUpperCase(),
    description: `${id} description`,
    stateSchema: {} as any,
    stateVersion: 1,
    getInitialState: () => ({ system: id, initialized: true }),
    validateState: (raw: unknown) => (raw ?? { system: id, initialized: true }) as any,
    migrateState: (_v: number, raw: unknown) => (raw ?? { system: id }) as any,
    onActivate: vi.fn().mockReturnValue({}),
    onDeactivate: vi.fn().mockReturnValue({}),
    getOrderedTasks: (tasks: Task[]) => tasks,
    onTaskCreated: () => ({}),
    onTaskCompleted: () => ({}),
    onTaskDeleted: () => ({}),
    reduce: vi.fn().mockReturnValue({}),
    getViewComponent: () => (() => null) as any,
    ...overrides,
  } as unknown as TimeManagementSystemHandler;
}

function makeRegistry(handlers: TimeManagementSystemHandler[]): HandlerLookup {
  const map = new Map(handlers.map(h => [h.id, h]));
  return (id: TMSSystemId) => {
    const h = map.get(id);
    if (!h) throw new Error(`Unknown TMS: "${id}"`);
    return h;
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TASKS = [makeTask('t1'), makeTask('t2')];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('executeTMSSwitch', () => {
  let af4Handler: TimeManagementSystemHandler;
  let fvpHandler: TimeManagementSystemHandler;
  let getHandler: HandlerLookup;

  beforeEach(() => {
    af4Handler = makeHandler('af4', {
      getInitialState: () => ({ backlogTaskIds: [], activeListTaskIds: [], currentPosition: 0 }),
      validateState: (raw: unknown) => (raw ?? { backlogTaskIds: [], activeListTaskIds: [], currentPosition: 0 }) as any,
      onActivate: vi.fn().mockReturnValue({ backlogTaskIds: ['t1', 't2'] }),
      onDeactivate: vi.fn().mockReturnValue({}),
    });

    fvpHandler = makeHandler('fvp', {
      getInitialState: () => ({ dottedTasks: [], scanPosition: 1 }),
      validateState: (raw: unknown) => (raw ?? { dottedTasks: [], scanPosition: 1 }) as any,
      onActivate: vi.fn().mockReturnValue({}),
      onDeactivate: vi.fn().mockReturnValue({}),
    });

    getHandler = makeRegistry([af4Handler, fvpHandler]);
  });

  // ── none → af4 ─────────────────────────────────────────────────────────────

  describe('none → af4', () => {
    it('returns newActiveSystem = af4', () => {
      const result = executeTMSSwitch('none', 'af4', TASKS, {}, getHandler);
      expect(result.newActiveSystem).toBe('af4');
    });

    it('calls onActivate on af4 handler with tasks and initial state', () => {
      executeTMSSwitch('none', 'af4', TASKS, {}, getHandler);
      expect(af4Handler.onActivate).toHaveBeenCalledWith(
        TASKS,
        expect.objectContaining({ backlogTaskIds: [], activeListTaskIds: [] }),
      );
    });

    it('does NOT call onDeactivate (fromId is none)', () => {
      executeTMSSwitch('none', 'af4', TASKS, {}, getHandler);
      expect(af4Handler.onDeactivate).not.toHaveBeenCalled();
      expect(fvpHandler.onDeactivate).not.toHaveBeenCalled();
    });

    it('systemStateUpdates contains af4 with merged activate delta', () => {
      const result = executeTMSSwitch('none', 'af4', TASKS, {}, getHandler);
      expect(result.systemStateUpdates).toHaveProperty('af4');
      expect(result.systemStateUpdates.af4).toMatchObject({ backlogTaskIds: ['t1', 't2'] });
    });

    it('systemStateUpdates does NOT contain fvp or none', () => {
      const result = executeTMSSwitch('none', 'af4', TASKS, {}, getHandler);
      expect(result.systemStateUpdates).not.toHaveProperty('fvp');
      expect(result.systemStateUpdates).not.toHaveProperty('none');
    });
  });

  // ── af4 → fvp ──────────────────────────────────────────────────────────────

  describe('af4 → fvp', () => {
    const af4State: SystemState = { backlogTaskIds: ['t1'], activeListTaskIds: [], currentPosition: 0 };

    it('calls onDeactivate on af4 BEFORE onActivate on fvp', () => {
      const callOrder: string[] = [];
      (af4Handler.onDeactivate as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('onDeactivate:af4');
        return {};
      });
      (fvpHandler.onActivate as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('onActivate:fvp');
        return {};
      });

      executeTMSSwitch('af4', 'fvp', TASKS, { af4: af4State }, getHandler);

      expect(callOrder).toEqual(['onDeactivate:af4', 'onActivate:fvp']);
    });

    it('returns newActiveSystem = fvp', () => {
      const result = executeTMSSwitch('af4', 'fvp', TASKS, { af4: af4State }, getHandler);
      expect(result.newActiveSystem).toBe('fvp');
    });

    it('systemStateUpdates contains fvp with merged activate delta', () => {
      (fvpHandler.onActivate as ReturnType<typeof vi.fn>).mockReturnValue({ dottedTasks: ['t1'] });
      const result = executeTMSSwitch('af4', 'fvp', TASKS, { af4: af4State }, getHandler);
      expect(result.systemStateUpdates).toHaveProperty('fvp');
      expect(result.systemStateUpdates.fvp).toMatchObject({ dottedTasks: ['t1'] });
    });

    it('systemStateUpdates does NOT contain af4 when onDeactivate returns empty delta', () => {
      (af4Handler.onDeactivate as ReturnType<typeof vi.fn>).mockReturnValue({});
      const result = executeTMSSwitch('af4', 'fvp', TASKS, { af4: af4State }, getHandler);
      expect(result.systemStateUpdates).not.toHaveProperty('af4');
    });

    it('systemStateUpdates contains af4 when onDeactivate returns non-empty delta', () => {
      (af4Handler.onDeactivate as ReturnType<typeof vi.fn>).mockReturnValue({ selectionInProgress: false });
      const result = executeTMSSwitch('af4', 'fvp', TASKS, { af4: af4State }, getHandler);
      expect(result.systemStateUpdates).toHaveProperty('af4');
      expect(result.systemStateUpdates.af4).toMatchObject({ selectionInProgress: false });
    });
  });

  // ── fvp → none ─────────────────────────────────────────────────────────────

  describe('fvp → none', () => {
    const fvpState: SystemState = { dottedTasks: ['t1'], scanPosition: 2 };

    it('calls onDeactivate on fvp', () => {
      executeTMSSwitch('fvp', 'none', TASKS, { fvp: fvpState }, getHandler);
      expect(fvpHandler.onDeactivate).toHaveBeenCalledWith(fvpState);
    });

    it('does NOT call onActivate on any handler', () => {
      executeTMSSwitch('fvp', 'none', TASKS, { fvp: fvpState }, getHandler);
      expect(af4Handler.onActivate).not.toHaveBeenCalled();
      expect(fvpHandler.onActivate).not.toHaveBeenCalled();
    });

    it('returns newActiveSystem = none', () => {
      const result = executeTMSSwitch('fvp', 'none', TASKS, { fvp: fvpState }, getHandler);
      expect(result.newActiveSystem).toBe('none');
    });

    it('systemStateUpdates is empty when onDeactivate returns empty delta', () => {
      (fvpHandler.onDeactivate as ReturnType<typeof vi.fn>).mockReturnValue({});
      const result = executeTMSSwitch('fvp', 'none', TASKS, { fvp: fvpState }, getHandler);
      expect(result.systemStateUpdates).toEqual({});
    });
  });

  // ── systemStateUpdates contains only changed systems ───────────────────────

  describe('systemStateUpdates — only changed systems', () => {
    it('does not include unchanged systems in the result', () => {
      const systemStates: Record<string, SystemState> = {
        af4: { backlogTaskIds: ['t1'] },
        fvp: { dottedTasks: [], scanPosition: 1 },
      };
      // af4 onDeactivate returns empty → no af4 update
      (af4Handler.onDeactivate as ReturnType<typeof vi.fn>).mockReturnValue({});
      // fvp onActivate returns empty → fvp update still included (activate always records)
      (fvpHandler.onActivate as ReturnType<typeof vi.fn>).mockReturnValue({});

      const result = executeTMSSwitch('af4', 'fvp', TASKS, systemStates, getHandler);

      // fvp is in updates (activate ran), af4 is NOT (deactivate returned {})
      expect(Object.keys(result.systemStateUpdates)).toEqual(['fvp']);
    });

    it('none → none returns empty systemStateUpdates', () => {
      const result = executeTMSSwitch('none', 'none', TASKS, {}, getHandler);
      expect(result.systemStateUpdates).toEqual({});
      expect(result.newActiveSystem).toBe('none');
    });
  });

  // ── Pure function — same inputs, same outputs ──────────────────────────────

  describe('pure function', () => {
    it('same inputs always produce the same output', () => {
      const systemStates: Record<string, SystemState> = {};
      (af4Handler.onActivate as ReturnType<typeof vi.fn>).mockReturnValue({ backlogTaskIds: ['t1', 't2'] });

      const result1 = executeTMSSwitch('none', 'af4', TASKS, systemStates, getHandler);
      const result2 = executeTMSSwitch('none', 'af4', TASKS, systemStates, getHandler);

      expect(result1).toEqual(result2);
    });

    it('does not mutate the input systemStates map', () => {
      const systemStates: Record<string, SystemState> = {
        af4: { backlogTaskIds: ['t1'] },
      };
      const originalKeys = Object.keys(systemStates);

      executeTMSSwitch('none', 'af4', TASKS, systemStates, getHandler);

      expect(Object.keys(systemStates)).toEqual(originalKeys);
      expect(systemStates.af4).toEqual({ backlogTaskIds: ['t1'] });
    });

    it('uses existing systemState for toId when present', () => {
      const existingFvpState: SystemState = { dottedTasks: ['t1'], scanPosition: 3 };
      // validateState is identity in the fixture — onActivate receives the existing state
      executeTMSSwitch('none', 'fvp', TASKS, { fvp: existingFvpState }, getHandler);

      expect(fvpHandler.onActivate).toHaveBeenCalledWith(TASKS, existingFvpState);
    });

    it('uses getInitialState for toId when no existing state', () => {
      executeTMSSwitch('none', 'fvp', TASKS, {}, getHandler);

      expect(fvpHandler.onActivate).toHaveBeenCalledWith(
        TASKS,
        expect.objectContaining({ dottedTasks: [], scanPosition: 1 }),
      );
    });
  });
});
