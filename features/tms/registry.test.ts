import { describe, it, expect, beforeEach } from 'vitest';
import { getTMSHandler, getAllTMSHandlers, registerTMSHandler } from './registry';
import type { TimeManagementSystemHandler } from './handlers';

describe('TMS registry', () => {
  describe('getTMSHandler', () => {
    it('returns the DIT handler by id', () => {
      const handler = getTMSHandler('dit');
      expect(handler.id).toBe('dit');
      expect(handler.displayName).toBeTruthy();
    });

    it('returns the AF4 handler by id', () => {
      const handler = getTMSHandler('af4');
      expect(handler.id).toBe('af4');
    });

    it('returns the FVP handler by id', () => {
      const handler = getTMSHandler('fvp');
      expect(handler.id).toBe('fvp');
    });

    it('returns the Standard handler by id', () => {
      const handler = getTMSHandler('none');
      expect(handler.id).toBe('none');
    });

    it('throws for an unknown id', () => {
      expect(() => getTMSHandler('unknown-system')).toThrow('Unknown TMS: "unknown-system"');
    });
  });

  describe('getAllTMSHandlers', () => {
    it('returns all four registered handlers', () => {
      const handlers = getAllTMSHandlers();
      const ids = handlers.map((h) => h.id);
      expect(ids).toContain('dit');
      expect(ids).toContain('af4');
      expect(ids).toContain('fvp');
      expect(ids).toContain('none');
    });

    it('returns at least four handlers', () => {
      expect(getAllTMSHandlers().length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('registerTMSHandler', () => {
    it('registers a new handler and makes it retrievable', () => {
      const testHandler: TimeManagementSystemHandler = {
        id: 'test-system',
        displayName: 'Test System',
        description: 'A test system',
        stateSchema: { parse: (v: unknown) => v } as never,
        stateVersion: 1,
        getInitialState: () => ({}),
        validateState: (_raw) => ({}),
        migrateState: (_fromVersion, _raw) => ({}),
        onActivate: (_tasks, _s) => ({}),
        onDeactivate: (_s) => ({}),
        getOrderedTasks: (tasks, _s) => tasks,
        onTaskCreated: (_task, _s) => ({}),
        onTaskCompleted: (_task, _s) => ({}),
        onTaskDeleted: (_taskId, _s) => ({}),
        reduce: (_s, _a) => ({}),
        getViewComponent: () => { throw new Error('not implemented'); },
      };

      registerTMSHandler(testHandler);
      expect(getTMSHandler('test-system').id).toBe('test-system');
    });

    it('calls validateState(getInitialState()) at registration time', () => {
      let validateCalled = false;
      const handler: TimeManagementSystemHandler = {
        id: 'validate-check',
        displayName: 'Validate Check',
        description: '',
        stateSchema: { parse: (v: unknown) => v } as never,
        stateVersion: 1,
        getInitialState: () => ({ ok: true }),
        validateState: (raw) => { validateCalled = true; return raw as object; },
        migrateState: (_fromVersion, raw) => raw as object,
        onActivate: (_tasks, _s) => ({}),
        onDeactivate: (_s) => ({}),
        getOrderedTasks: (tasks, _s) => tasks,
        onTaskCreated: (_task, _s) => ({}),
        onTaskCompleted: (_task, _s) => ({}),
        onTaskDeleted: (_taskId, _s) => ({}),
        reduce: (_s, _a) => ({}),
        getViewComponent: () => { throw new Error('not implemented'); },
      };

      registerTMSHandler(handler);
      expect(validateCalled).toBe(true);
    });

    it('throws at registration time if validateState throws', () => {
      const badHandler: TimeManagementSystemHandler = {
        id: 'bad-handler',
        displayName: 'Bad Handler',
        description: '',
        stateSchema: { parse: (v: unknown) => v } as never,
        stateVersion: 1,
        getInitialState: () => ({}),
        validateState: () => { throw new Error('invalid state'); },
        migrateState: (_fromVersion, _raw) => ({}),
        onActivate: (_tasks, _s) => ({}),
        onDeactivate: (_s) => ({}),
        getOrderedTasks: (tasks, _s) => tasks,
        onTaskCreated: (_task, _s) => ({}),
        onTaskCompleted: (_task, _s) => ({}),
        onTaskDeleted: (_taskId, _s) => ({}),
        reduce: (_s, _a) => ({}),
        getViewComponent: () => { throw new Error('not implemented'); },
      };

      expect(() => registerTMSHandler(badHandler)).toThrow('invalid state');
    });
  });

  describe('built-in handlers pass validateState(getInitialState())', () => {
    it.each(['dit', 'af4', 'fvp', 'none'])('%s handler validates its initial state without throwing', (id) => {
      const handler = getTMSHandler(id);
      expect(() => handler.validateState(handler.getInitialState())).not.toThrow();
    });
  });
});
