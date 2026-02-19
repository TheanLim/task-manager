import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActionHandler,
  ACTION_HANDLER_REGISTRY,
  type ActionContext,
} from './actionHandlers';
import type { RuleAction, DomainEvent, UndoSnapshot, ActionType } from '../types';

// ---------------------------------------------------------------------------
// In-memory mock repos
// ---------------------------------------------------------------------------

function createMockTaskRepo() {
  const tasks = new Map<string, any>();
  return {
    findById: (id: string) => tasks.get(id) ?? null,
    findAll: () => Array.from(tasks.values()),
    create: (t: any) => { tasks.set(t.id, t); },
    update: (id: string, updates: any) => {
      const t = tasks.get(id);
      if (t) tasks.set(id, { ...t, ...updates });
    },
    delete: (id: string) => { tasks.delete(id); },
    _set: (id: string, t: any) => { tasks.set(id, t); },
    _get: (id: string) => tasks.get(id),
    _clear: () => tasks.clear(),
  };
}

function createMockSectionRepo() {
  const sections = new Map<string, any>();
  return {
    findById: (id: string) => sections.get(id) ?? null,
    findAll: () => Array.from(sections.values()),
    _set: (id: string, s: any) => { sections.set(id, s); },
  };
}

function createMockTaskService() {
  return {
    cascadeComplete: vi.fn(),
  };
}

function makeTask(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    projectId: 'proj-1',
    parentTaskId: null,
    sectionId: 'section-a',
    description: `Task ${id}`,
    notes: '',
    assignee: '',
    priority: 'none',
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    lastActionAt: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    type: 'task.updated',
    entityId: 'task-1',
    projectId: 'proj-1',
    changes: {},
    previousValues: {},
    depth: 0,
    ...overrides,
  };
}

function makeAction(actionType: ActionType, overrides: Partial<RuleAction> = {}): RuleAction {
  return {
    ruleId: 'rule-1',
    actionType,
    targetEntityId: 'task-1',
    params: {},
    ...overrides,
  };
}

describe('actionHandlers', () => {
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let sectionRepo: ReturnType<typeof createMockSectionRepo>;
  let taskService: ReturnType<typeof createMockTaskService>;
  let ctx: ActionContext;

  beforeEach(() => {
    taskRepo = createMockTaskRepo();
    sectionRepo = createMockSectionRepo();
    taskService = createMockTaskService();
    ctx = { taskRepo: taskRepo as any, sectionRepo: sectionRepo as any, taskService: taskService as any };
  });

  describe('getActionHandler', () => {
    it('returns a handler for every known action type', () => {
      const types: ActionType[] = [
        'move_card_to_top_of_section',
        'move_card_to_bottom_of_section',
        'mark_card_complete',
        'mark_card_incomplete',
        'set_due_date',
        'remove_due_date',
        'create_card',
      ];
      for (const t of types) {
        const handler = getActionHandler(t);
        expect(handler).toBeDefined();
        expect(handler.execute).toBeTypeOf('function');
        expect(handler.describe).toBeTypeOf('function');
        expect(handler.undo).toBeTypeOf('function');
      }
    });

    it('throws for unknown action type', () => {
      expect(() => getActionHandler('nonexistent' as ActionType)).toThrow('Unknown action type');
    });
  });

  describe('move_card_to_top_of_section', () => {
    it('moves task to top of target section', () => {
      taskRepo._set('task-1', makeTask('task-1', { sectionId: 'section-a', order: 5 }));
      taskRepo._set('task-2', makeTask('task-2', { sectionId: 'section-b', order: 3 }));
      sectionRepo._set('section-b', { id: 'section-b', name: 'Done', projectId: 'proj-1' });

      const handler = getActionHandler('move_card_to_top_of_section');
      const events = handler.execute(
        makeAction('move_card_to_top_of_section', { params: { sectionId: 'section-b' } }),
        makeEvent(),
        ctx
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task.updated');
      const updated = taskRepo._get('task-1');
      expect(updated.sectionId).toBe('section-b');
      expect(updated.order).toBeLessThan(3);
    });

    it('returns empty when task does not exist', () => {
      const handler = getActionHandler('move_card_to_top_of_section');
      const events = handler.execute(
        makeAction('move_card_to_top_of_section', { params: { sectionId: 'section-b' } }),
        makeEvent(),
        ctx
      );
      expect(events).toHaveLength(0);
    });
  });

  describe('mark_card_complete', () => {
    it('calls cascadeComplete and emits event', () => {
      taskRepo._set('task-1', makeTask('task-1'));

      const handler = getActionHandler('mark_card_complete');
      const events = handler.execute(makeAction('mark_card_complete'), makeEvent(), ctx);

      expect(taskService.cascadeComplete).toHaveBeenCalledWith('task-1', true);
      expect(events).toHaveLength(1);
      expect(events[0].changes).toEqual({ completed: true });
    });
  });

  describe('mark_card_incomplete', () => {
    it('calls cascadeComplete(false) and emits event', () => {
      taskRepo._set('task-1', makeTask('task-1', { completed: true }));

      const handler = getActionHandler('mark_card_incomplete');
      const events = handler.execute(makeAction('mark_card_incomplete'), makeEvent(), ctx);

      expect(taskService.cascadeComplete).toHaveBeenCalledWith('task-1', false);
      expect(events).toHaveLength(1);
      expect(events[0].changes).toEqual({ completed: false });
    });
  });

  describe('set_due_date', () => {
    it('sets due date on task', () => {
      taskRepo._set('task-1', makeTask('task-1'));

      const handler = getActionHandler('set_due_date');
      const events = handler.execute(
        makeAction('set_due_date', { params: { dateOption: 'tomorrow' } }),
        makeEvent(),
        ctx
      );

      expect(events).toHaveLength(1);
      const updated = taskRepo._get('task-1');
      expect(updated.dueDate).not.toBeNull();
    });

    it('returns empty when no dateOption', () => {
      taskRepo._set('task-1', makeTask('task-1'));
      const handler = getActionHandler('set_due_date');
      const events = handler.execute(makeAction('set_due_date'), makeEvent(), ctx);
      expect(events).toHaveLength(0);
    });
  });

  describe('remove_due_date', () => {
    it('removes due date from task', () => {
      taskRepo._set('task-1', makeTask('task-1', { dueDate: '2025-06-01' }));

      const handler = getActionHandler('remove_due_date');
      const events = handler.execute(makeAction('remove_due_date'), makeEvent(), ctx);

      expect(events).toHaveLength(1);
      expect(taskRepo._get('task-1').dueDate).toBeNull();
    });
  });

  describe('create_card', () => {
    it('creates a new task in the target section', () => {
      sectionRepo._set('section-b', { id: 'section-b', name: 'Done', projectId: 'proj-1' });

      const handler = getActionHandler('create_card');
      const events = handler.execute(
        makeAction('create_card', {
          targetEntityId: 'irrelevant',
          params: { sectionId: 'section-b', cardTitle: 'New card' },
        }),
        makeEvent(),
        ctx
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task.created');
      const allTasks = taskRepo.findAll();
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].description).toBe('New card');
    });

    it('returns empty when section does not exist', () => {
      const handler = getActionHandler('create_card');
      const events = handler.execute(
        makeAction('create_card', { params: { sectionId: 'nonexistent', cardTitle: 'X' } }),
        makeEvent(),
        ctx
      );
      expect(events).toHaveLength(0);
    });
  });

  describe('describe()', () => {
    it('move handlers include section name', () => {
      sectionRepo._set('s1', { id: 's1', name: 'Backlog', projectId: 'p1' });
      const desc = getActionHandler('move_card_to_top_of_section').describe({ sectionId: 's1' }, ctx);
      expect(desc).toContain('Backlog');
    });

    it('mark_card_complete returns static description', () => {
      expect(getActionHandler('mark_card_complete').describe({}, ctx)).toBe('Marked as complete');
    });

    it('create_card includes card title', () => {
      expect(getActionHandler('create_card').describe({ cardTitle: 'My Card' }, ctx)).toContain('My Card');
    });
  });

  describe('undo()', () => {
    it('move undo restores sectionId and order', () => {
      taskRepo._set('task-1', makeTask('task-1', { sectionId: 'section-b', order: 10 }));

      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'move_card_to_top_of_section',
        targetEntityId: 'task-1',
        previousState: { sectionId: 'section-a', order: 5 },
        timestamp: Date.now(),
      };

      getActionHandler('move_card_to_top_of_section').undo(snapshot, ctx);
      const task = taskRepo._get('task-1');
      expect(task.sectionId).toBe('section-a');
      expect(task.order).toBe(5);
    });

    it('mark_complete undo restores completed state and subtasks', () => {
      taskRepo._set('task-1', makeTask('task-1', { completed: true }));
      taskRepo._set('sub-1', makeTask('sub-1', { completed: true, parentTaskId: 'task-1' }));

      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        subtaskSnapshots: [{ taskId: 'sub-1', previousState: { completed: false, completedAt: null } }],
        timestamp: Date.now(),
      };

      getActionHandler('mark_card_complete').undo(snapshot, ctx);
      expect(taskRepo._get('task-1').completed).toBe(false);
      expect(taskRepo._get('sub-1').completed).toBe(false);
    });

    it('create_card undo deletes the created task', () => {
      taskRepo._set('created-1', makeTask('created-1'));

      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'create_card',
        targetEntityId: 'created-1',
        createdEntityId: 'created-1',
        previousState: {},
        timestamp: Date.now(),
      };

      getActionHandler('create_card').undo(snapshot, ctx);
      expect(taskRepo._get('created-1')).toBeUndefined();
    });
  });
});
