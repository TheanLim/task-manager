import { describe, it, expect } from 'vitest';
import { sortTasks, sortByLastAction } from './taskSortService';
import type { Task } from '@/lib/schemas';

const NOW = '2026-02-18T00:00:00.000Z';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', projectId: null, parentTaskId: null, sectionId: null,
    description: 'Task', notes: '', assignee: '', priority: 'none',
    tags: [], dueDate: null, completed: false, completedAt: null,
    order: 0, createdAt: NOW, updatedAt: NOW,
    ...overrides,
  };
}

const noProject = () => 'No Project';

describe('sortTasks', () => {
  it('returns input unchanged when sortColumn is null', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    expect(sortTasks(tasks, null, 'asc', noProject)).toBe(tasks);
  });

  it('sorts by name ascending', () => {
    const tasks = [
      makeTask({ id: 'b', description: 'Banana' }),
      makeTask({ id: 'a', description: 'Apple' }),
    ];
    const sorted = sortTasks(tasks, 'name', 'asc', noProject);
    expect(sorted.map(t => t.description)).toEqual(['Apple', 'Banana']);
  });

  it('sorts by name descending', () => {
    const tasks = [
      makeTask({ id: 'a', description: 'Apple' }),
      makeTask({ id: 'b', description: 'Banana' }),
    ];
    const sorted = sortTasks(tasks, 'name', 'desc', noProject);
    expect(sorted.map(t => t.description)).toEqual(['Banana', 'Apple']);
  });

  it('sorts by priority (high first in asc)', () => {
    const tasks = [
      makeTask({ id: 'low', priority: 'low' }),
      makeTask({ id: 'high', priority: 'high' }),
      makeTask({ id: 'med', priority: 'medium' }),
    ];
    const sorted = sortTasks(tasks, 'priority', 'asc', noProject);
    expect(sorted.map(t => t.id)).toEqual(['high', 'med', 'low']);
  });

  it('sorts by dueDate with nulls at end', () => {
    const tasks = [
      makeTask({ id: 'none', dueDate: null }),
      makeTask({ id: 'early', dueDate: '2026-01-01' }),
      makeTask({ id: 'late', dueDate: '2026-12-31' }),
    ];
    const sorted = sortTasks(tasks, 'dueDate', 'asc', noProject);
    expect(sorted.map(t => t.id)).toEqual(['early', 'late', 'none']);
  });

  it('sorts by assignee with empty at end', () => {
    const tasks = [
      makeTask({ id: 'empty', assignee: '' }),
      makeTask({ id: 'bob', assignee: 'Bob' }),
      makeTask({ id: 'alice', assignee: 'Alice' }),
    ];
    const sorted = sortTasks(tasks, 'assignee', 'asc', noProject);
    expect(sorted.map(t => t.id)).toEqual(['alice', 'bob', 'empty']);
  });

  it('sorts by tags count then alphabetically', () => {
    const tasks = [
      makeTask({ id: 'two', tags: ['b', 'a'] }),
      makeTask({ id: 'one', tags: ['c'] }),
      makeTask({ id: 'zero', tags: [] }),
    ];
    const sorted = sortTasks(tasks, 'tags', 'asc', noProject);
    expect(sorted.map(t => t.id)).toEqual(['zero', 'one', 'two']);
  });

  it('sorts by project with No Project at end', () => {
    const lookup = (t: Task) => t.projectId === 'p1' ? 'Alpha' : 'No Project';
    const tasks = [
      makeTask({ id: 'none', projectId: null }),
      makeTask({ id: 'alpha', projectId: 'p1' }),
    ];
    const sorted = sortTasks(tasks, 'project', 'asc', lookup);
    expect(sorted.map(t => t.id)).toEqual(['alpha', 'none']);
  });

  it('does not mutate the input array', () => {
    const tasks = [
      makeTask({ id: 'b', description: 'B' }),
      makeTask({ id: 'a', description: 'A' }),
    ];
    const original = [...tasks];
    sortTasks(tasks, 'name', 'asc', noProject);
    expect(tasks).toEqual(original);
  });
});

describe('sortByLastAction', () => {
  it('sorts by lastActionAt ascending, falling back to createdAt', () => {
    const tasks = [
      makeTask({ id: 'recent', createdAt: '2026-02-01T00:00:00Z', lastActionAt: '2026-02-18T00:00:00Z' } as any),
      makeTask({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
    ];
    const sorted = sortByLastAction(tasks);
    expect(sorted.map(t => t.id)).toEqual(['old', 'recent']);
  });
});
