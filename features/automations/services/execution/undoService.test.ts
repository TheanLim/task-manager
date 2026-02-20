import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUndoSnapshot,
  getUndoSnapshots,
  setUndoSnapshot,
  pushUndoSnapshot,
  clearUndoSnapshot,
  clearAllUndoSnapshots,
  performUndo,
  performUndoById,
  buildUndoSnapshot,
  UNDO_EXPIRY_MS,
} from './undoService';
import type { UndoSnapshot } from '../../types';
import type { DomainEvent, RuleAction } from '../../types';

function makeSnapshot(overrides: Partial<UndoSnapshot> = {}): UndoSnapshot {
  return {
    ruleId: 'rule-1',
    ruleName: 'Test Rule',
    actionType: 'mark_card_complete',
    targetEntityId: 'task-1',
    previousState: { completed: false, completedAt: null },
    timestamp: Date.now(),
    ...overrides,
  };
}

// Minimal mock task repo using Map
function makeMockTaskRepo() {
  const tasks = new Map<string, any>();
  return {
    findById: (id: string) => tasks.get(id),
    findAll: () => Array.from(tasks.values()),
    create: (t: any) => { tasks.set(t.id, t); },
    update: (id: string, updates: any) => {
      const t = tasks.get(id);
      if (t) tasks.set(id, { ...t, ...updates });
    },
    delete: (id: string) => { tasks.delete(id); },
    findByProjectId: () => [],
    findByParentTaskId: () => [],
    replaceAll: () => {},
    subscribe: () => () => {},
  };
}

describe('undoService snapshot management', () => {
  beforeEach(() => {
    clearAllUndoSnapshots();
  });

  it('returns null when no snapshot is set', () => {
    expect(getUndoSnapshot()).toBeNull();
    expect(getUndoSnapshots()).toEqual([]);
  });

  it('setUndoSnapshot stores and retrieves a snapshot', () => {
    const snap = makeSnapshot();
    setUndoSnapshot(snap);
    expect(getUndoSnapshot()).toEqual(snap);
  });

  it('setUndoSnapshot(null) clears the snapshot', () => {
    setUndoSnapshot(makeSnapshot());
    setUndoSnapshot(null);
    expect(getUndoSnapshot()).toBeNull();
  });

  it('setUndoSnapshot replaces entire stack (Req 6.9)', () => {
    pushUndoSnapshot(makeSnapshot({ ruleId: 'a' }));
    pushUndoSnapshot(makeSnapshot({ ruleId: 'b' }));
    const replacement = makeSnapshot({ ruleId: 'c' });
    setUndoSnapshot(replacement);
    expect(getUndoSnapshots()).toHaveLength(1);
    expect(getUndoSnapshots()[0].ruleId).toBe('c');
  });

  it('pushUndoSnapshot adds to stack', () => {
    pushUndoSnapshot(makeSnapshot({ ruleId: 'a' }));
    pushUndoSnapshot(makeSnapshot({ ruleId: 'b' }));
    expect(getUndoSnapshots()).toHaveLength(2);
    expect(getUndoSnapshot()!.ruleId).toBe('b');
  });

  it('clearUndoSnapshot empties everything', () => {
    pushUndoSnapshot(makeSnapshot());
    clearUndoSnapshot();
    expect(getUndoSnapshot()).toBeNull();
    expect(getUndoSnapshots()).toEqual([]);
  });

  it('clearAllUndoSnapshots empties everything', () => {
    pushUndoSnapshot(makeSnapshot({ ruleId: 'a' }));
    pushUndoSnapshot(makeSnapshot({ ruleId: 'b' }));
    clearAllUndoSnapshots();
    expect(getUndoSnapshot()).toBeNull();
    expect(getUndoSnapshots()).toEqual([]);
  });

  it('expired snapshots are filtered out', () => {
    const expired = makeSnapshot({ timestamp: Date.now() - UNDO_EXPIRY_MS - 1 });
    setUndoSnapshot(expired);
    expect(getUndoSnapshot()).toBeNull();
    expect(getUndoSnapshots()).toEqual([]);
  });
});

describe('performUndo', () => {
  beforeEach(() => {
    clearAllUndoSnapshots();
  });

  it('returns false when no snapshot exists', () => {
    const repo = makeMockTaskRepo();
    expect(performUndo(repo as any)).toBe(false);
  });

  it('reverts a move action and clears snapshot', () => {
    const repo = makeMockTaskRepo();
    repo.create({ id: 'task-1', sectionId: 'new-section', order: 5 });

    setUndoSnapshot(makeSnapshot({
      actionType: 'move_card_to_bottom_of_section',
      targetEntityId: 'task-1',
      previousState: { sectionId: 'old-section', order: 2 },
    }));

    expect(performUndo(repo as any)).toBe(true);
    expect(repo.findById('task-1').sectionId).toBe('old-section');
    expect(repo.findById('task-1').order).toBe(2);
    expect(getUndoSnapshot()).toBeNull();
  });

  it('reverts a mark_card_complete action including subtasks', () => {
    const repo = makeMockTaskRepo();
    repo.create({ id: 'task-1', completed: true, completedAt: '2026-01-01T00:00:00Z' });
    repo.create({ id: 'sub-1', completed: true, completedAt: '2026-01-01T00:00:00Z' });

    setUndoSnapshot(makeSnapshot({
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      subtaskSnapshots: [
        { taskId: 'sub-1', previousState: { completed: false, completedAt: null } },
      ],
    }));

    performUndo(repo as any);
    expect(repo.findById('task-1').completed).toBe(false);
    expect(repo.findById('sub-1').completed).toBe(false);
  });

  it('reverts a set_due_date action', () => {
    const repo = makeMockTaskRepo();
    repo.create({ id: 'task-1', dueDate: '2026-06-01T00:00:00Z' });

    setUndoSnapshot(makeSnapshot({
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      previousState: { dueDate: null },
    }));

    performUndo(repo as any);
    expect(repo.findById('task-1').dueDate).toBeNull();
  });

  it('reverts a create_card action by deleting the created task', () => {
    const repo = makeMockTaskRepo();
    repo.create({ id: 'new-task' });

    setUndoSnapshot(makeSnapshot({
      actionType: 'create_card',
      targetEntityId: 'new-task',
      createdEntityId: 'new-task',
      previousState: {},
    }));

    performUndo(repo as any);
    expect(repo.findById('new-task')).toBeUndefined();
  });
});

describe('performUndoById', () => {
  beforeEach(() => {
    clearAllUndoSnapshots();
  });

  it('undoes a specific rule and leaves others in stack', () => {
    const repo = makeMockTaskRepo();
    repo.create({ id: 'task-a', completed: true, completedAt: '2026-01-01T00:00:00Z' });
    repo.create({ id: 'task-b', sectionId: 'new', order: 5 });

    pushUndoSnapshot(makeSnapshot({
      ruleId: 'rule-a',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-a',
      previousState: { completed: false, completedAt: null },
    }));
    pushUndoSnapshot(makeSnapshot({
      ruleId: 'rule-b',
      actionType: 'move_card_to_bottom_of_section',
      targetEntityId: 'task-b',
      previousState: { sectionId: 'old', order: 1 },
    }));

    expect(performUndoById('rule-a', repo as any)).toBe(true);
    expect(repo.findById('task-a').completed).toBe(false);
    // rule-b still in stack
    expect(getUndoSnapshots()).toHaveLength(1);
    expect(getUndoSnapshots()[0].ruleId).toBe('rule-b');
  });

  it('returns false for nonexistent ruleId', () => {
    const repo = makeMockTaskRepo();
    pushUndoSnapshot(makeSnapshot({ ruleId: 'rule-a' }));
    expect(performUndoById('rule-z', repo as any)).toBe(false);
  });

  it('returns false for expired snapshot', () => {
    const repo = makeMockTaskRepo();
    pushUndoSnapshot(makeSnapshot({
      ruleId: 'rule-a',
      timestamp: Date.now() - UNDO_EXPIRY_MS - 1,
    }));
    expect(performUndoById('rule-a', repo as any)).toBe(false);
  });
});

describe('buildUndoSnapshot', () => {
  it('builds snapshot from move action', () => {
    const action: RuleAction = {
      ruleId: 'rule-1',
      targetEntityId: 'task-1',
      actionType: 'move_card_to_top_of_section',
      params: { sectionId: 'sec-2' },
    };
    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: { sectionId: 'sec-2' },
      previousValues: { sectionId: 'sec-1', order: 3 },
      depth: 1,
    };

    const snap = buildUndoSnapshot(action, 'My Rule', event);
    expect(snap.ruleId).toBe('rule-1');
    expect(snap.ruleName).toBe('My Rule');
    expect(snap.actionType).toBe('move_card_to_top_of_section');
    expect(snap.previousState.sectionId).toBe('sec-1');
    expect(snap.previousState.order).toBe(3);
  });

  it('builds snapshot for create_card with createdEntityId', () => {
    const action: RuleAction = {
      ruleId: 'rule-1',
      targetEntityId: 'placeholder',
      actionType: 'create_card',
      params: { sectionId: 'sec-1', cardTitle: 'New' },
    };
    const event: DomainEvent = {
      type: 'task.created',
      entityId: 'created-task-id',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 1,
    };

    const snap = buildUndoSnapshot(action, 'Create Rule', event);
    expect(snap.createdEntityId).toBe('created-task-id');
    expect(snap.targetEntityId).toBe('created-task-id');
  });
});
