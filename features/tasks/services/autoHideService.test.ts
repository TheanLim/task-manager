import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/schemas';
import {
  getThresholdMs,
  isTaskAutoHidden,
  filterAutoHiddenTasks,
} from './autoHideService';

function makeTask(
  id: string,
  overrides: Partial<Task> = {},
): Task {
  const now = new Date().toISOString();
  return {
    id,
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    description: 'task',
    notes: '',
    assignee: '',
    priority: 'none',
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const NOW = Date.parse('2025-07-01T12:00:00.000Z');

describe('getThresholdMs', () => {
  it('returns 86_400_000 for 24h', () => {
    expect(getThresholdMs('24h')).toBe(86_400_000);
  });

  it('returns 172_800_000 for 48h', () => {
    expect(getThresholdMs('48h')).toBe(172_800_000);
  });

  it('returns 604_800_000 for 1w', () => {
    expect(getThresholdMs('1w')).toBe(604_800_000);
  });

  it('returns null for show-all', () => {
    expect(getThresholdMs('show-all')).toBeNull();
  });

  it('returns 0 for always', () => {
    expect(getThresholdMs('always')).toBe(0);
  });
});

describe('isTaskAutoHidden', () => {
  const thresholdMs = 86_400_000; // 24h

  it('returns false for non-completed task', () => {
    const task = makeTask('t1');
    expect(isTaskAutoHidden(task, thresholdMs, NOW)).toBe(false);
  });

  it('returns false when completedAt is null (defensive)', () => {
    const task = makeTask('t2', { completed: true, completedAt: null });
    expect(isTaskAutoHidden(task, thresholdMs, NOW)).toBe(false);
  });

  it('returns true when completed past threshold', () => {
    const completedAt = new Date(NOW - thresholdMs - 1000).toISOString();
    const task = makeTask('t3', { completed: true, completedAt });
    expect(isTaskAutoHidden(task, thresholdMs, NOW)).toBe(true);
  });

  it('returns false when completed within threshold', () => {
    const completedAt = new Date(NOW - thresholdMs + 60_000).toISOString();
    const task = makeTask('t4', { completed: true, completedAt });
    expect(isTaskAutoHidden(task, thresholdMs, NOW)).toBe(false);
  });

  it('returns true at exact threshold boundary', () => {
    const completedAt = new Date(NOW - thresholdMs).toISOString();
    const task = makeTask('t5', { completed: true, completedAt });
    expect(isTaskAutoHidden(task, thresholdMs, NOW)).toBe(true);
  });
});

describe('filterAutoHiddenTasks', () => {
  const threshold24h = 86_400_000;

  it('returns empty result for empty input', () => {
    const result = filterAutoHiddenTasks([], [], {
      threshold: '24h',
      displayMode: 'nested',
      now: NOW,
    });
    expect(result.visible).toEqual([]);
    expect(result.autoHidden).toEqual([]);
  });

  it('returns all tasks visible when threshold is show-all', () => {
    const tasks = [
      makeTask('t1', { completed: true, completedAt: new Date(NOW - 999_999_999).toISOString() }),
      makeTask('t2', { completed: false }),
    ];
    const result = filterAutoHiddenTasks(tasks, tasks, {
      threshold: 'show-all',
      displayMode: 'nested',
      now: NOW,
    });
    expect(result.visible).toHaveLength(2);
    expect(result.autoHidden).toHaveLength(0);
  });

  it('hides all completed tasks when threshold is always', () => {
    const tasks = [
      makeTask('t1', { completed: true, completedAt: new Date(NOW - 1000).toISOString() }),
      makeTask('t2', { completed: false }),
    ];
    const result = filterAutoHiddenTasks(tasks, tasks, {
      threshold: 'always',
      displayMode: 'nested',
      now: NOW,
    });
    expect(result.autoHidden.map(t => t.id)).toEqual(['t1']);
    expect(result.visible.map(t => t.id)).toEqual(['t2']);
  });

  describe('nested mode', () => {
    it('hides parent task past threshold and all its subtasks', () => {
      const parent = makeTask('p1', {
        completed: true,
        completedAt: new Date(NOW - threshold24h - 1000).toISOString(),
      });
      const sub1 = makeTask('s1', { parentTaskId: 'p1', completed: true, completedAt: new Date(NOW - 1000).toISOString() });
      const sub2 = makeTask('s2', { parentTaskId: 'p1', completed: false });
      const allTasks = [parent, sub1, sub2];

      const result = filterAutoHiddenTasks(allTasks, allTasks, {
        threshold: '24h',
        displayMode: 'nested',
        now: NOW,
      });
      expect(result.autoHidden.map((t) => t.id).sort()).toEqual(['p1', 's1', 's2'].sort());
      expect(result.visible).toHaveLength(0);
    });

    it('keeps completed subtasks visible when parent is active', () => {
      const parent = makeTask('p1', { completed: false });
      const sub1 = makeTask('s1', {
        parentTaskId: 'p1',
        completed: true,
        completedAt: new Date(NOW - threshold24h - 1000).toISOString(),
      });
      const allTasks = [parent, sub1];

      const result = filterAutoHiddenTasks(allTasks, allTasks, {
        threshold: '24h',
        displayMode: 'nested',
        now: NOW,
      });
      expect(result.visible.map((t) => t.id).sort()).toEqual(['p1', 's1'].sort());
      expect(result.autoHidden).toHaveLength(0);
    });

    it('evaluates orphan subtask independently when parent not found', () => {
      const orphan = makeTask('s1', {
        parentTaskId: 'missing-parent',
        completed: true,
        completedAt: new Date(NOW - threshold24h - 1000).toISOString(),
      });

      const result = filterAutoHiddenTasks([orphan], [], {
        threshold: '24h',
        displayMode: 'nested',
        now: NOW,
      });
      expect(result.autoHidden).toHaveLength(1);
      expect(result.visible).toHaveLength(0);
    });
  });

  describe('showRecentlyCompleted semantics', () => {
    // These tests document the contract that GlobalTasksView relies on:
    // when showRecentlyCompleted is on, the view shows only completed tasks
    // still within the threshold window (result.visible.filter(completed)).
    // Aged-out tasks (autoHidden) are excluded — the threshold is respected.

    it('recently completed task (within threshold) lands in visible, not autoHidden', () => {
      const recentlyCompleted = makeTask('t1', {
        completed: true,
        completedAt: new Date(NOW - 3_600_000).toISOString(), // 1h ago, within 24h
      });

      const result = filterAutoHiddenTasks([recentlyCompleted], [recentlyCompleted], {
        threshold: '24h',
        displayMode: 'nested',
        now: NOW,
      });

      expect(result.visible.map((t) => t.id)).toEqual(['t1']);
      expect(result.autoHidden).toHaveLength(0);
    });

    it('aged-out completed task (past threshold) lands in autoHidden, not visible', () => {
      const agedOut = makeTask('t1', {
        completed: true,
        completedAt: new Date(NOW - 86_400_000 - 1000).toISOString(), // just past 24h
      });

      const result = filterAutoHiddenTasks([agedOut], [agedOut], {
        threshold: '24h',
        displayMode: 'nested',
        now: NOW,
      });

      expect(result.autoHidden.map((t) => t.id)).toEqual(['t1']);
      expect(result.visible).toHaveLength(0);
    });

    it('showRecentlyCompleted shows only visible completed — aged-out excluded', () => {
      const recent = makeTask('recent', {
        completed: true,
        completedAt: new Date(NOW - 3_600_000).toISOString(), // 1h ago
      });
      const agedOut = makeTask('aged', {
        completed: true,
        completedAt: new Date(NOW - 86_400_000 - 1000).toISOString(), // past 24h
      });
      const incomplete = makeTask('active');

      const all = [recent, agedOut, incomplete];
      const result = filterAutoHiddenTasks(all, all, {
        threshold: '24h',
        displayMode: 'nested',
        now: NOW,
      });

      // GlobalTasksView uses result.visible.filter(t => t.completed) for showRecentlyCompleted
      const recentlyDone = result.visible.filter(t => t.completed);
      expect(recentlyDone.map((t) => t.id)).toEqual(['recent']);
      // aged-out is in autoHidden — not shown
      expect(result.autoHidden.map((t) => t.id)).toEqual(['aged']);
    });
  });

  describe('flat mode', () => {
    it('evaluates parent tasks independently', () => {
      const old = makeTask('p1', {
        completed: true,
        completedAt: new Date(NOW - threshold24h - 1000).toISOString(),
      });
      const recent = makeTask('p2', {
        completed: true,
        completedAt: new Date(NOW - 1000).toISOString(),
      });

      const result = filterAutoHiddenTasks([old, recent], [old, recent], {
        threshold: '24h',
        displayMode: 'flat',
        now: NOW,
      });
      expect(result.autoHidden.map((t) => t.id)).toEqual(['p1']);
      expect(result.visible.map((t) => t.id)).toEqual(['p2']);
    });

    it('keeps completed subtask visible when parent is active', () => {
      const parent = makeTask('p1', { completed: false });
      const sub = makeTask('s1', {
        parentTaskId: 'p1',
        completed: true,
        completedAt: new Date(NOW - threshold24h - 1000).toISOString(),
      });

      const result = filterAutoHiddenTasks([parent, sub], [parent, sub], {
        threshold: '24h',
        displayMode: 'flat',
        now: NOW,
      });
      expect(result.visible.map((t) => t.id).sort()).toEqual(['p1', 's1'].sort());
      expect(result.autoHidden).toHaveLength(0);
    });

    it('hides subtask when parent is completed and auto-hidden', () => {
      const parent = makeTask('p1', {
        completed: true,
        completedAt: new Date(NOW - threshold24h - 1000).toISOString(),
      });
      const sub = makeTask('s1', {
        parentTaskId: 'p1',
        completed: true,
        completedAt: new Date(NOW - threshold24h - 500).toISOString(),
      });

      const result = filterAutoHiddenTasks([parent, sub], [parent, sub], {
        threshold: '24h',
        displayMode: 'flat',
        now: NOW,
      });
      expect(result.autoHidden.map((t) => t.id).sort()).toEqual(['p1', 's1'].sort());
      expect(result.visible).toHaveLength(0);
    });
  });
});
