import { describe, it, expect } from 'vitest';
import { buildFvpSnapshot, isTaskInSnapshot } from './fvpSnapshotService';
import type { Task } from '@/types';

// Minimal task fixture — only id and completed are relevant here
function makeTask(id: string, completed = false): Task {
  return {
    id,
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    description: 'Test task',
    notes: '',
    assignee: '',
    priority: 'none',
    tags: [],
    dueDate: null,
    completed,
    completedAt: null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('buildFvpSnapshot', () => {
  it('returns empty array for empty input', () => {
    expect(buildFvpSnapshot([])).toEqual([]);
  });

  it('returns all task IDs', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')];
    expect(buildFvpSnapshot(tasks)).toEqual(['a', 'b', 'c']);
  });

  it('includes completed tasks in snapshot', () => {
    const tasks = [makeTask('done', true), makeTask('active', false)];
    const snapshot = buildFvpSnapshot(tasks);
    expect(snapshot).toContain('done');
    expect(snapshot).toContain('active');
  });

  it('is a pure function — same input produces same output', () => {
    const tasks = [makeTask('x'), makeTask('y')];
    expect(buildFvpSnapshot(tasks)).toEqual(buildFvpSnapshot(tasks));
  });
});

describe('isTaskInSnapshot', () => {
  it('returns true when id is in snapshot', () => {
    expect(isTaskInSnapshot('id', ['id', 'other'])).toBe(true);
  });

  it('returns false when id is not in snapshot', () => {
    expect(isTaskInSnapshot('missing', ['id'])).toBe(false);
  });

  it('returns false for empty snapshot', () => {
    expect(isTaskInSnapshot('id', [])).toBe(false);
  });
});
