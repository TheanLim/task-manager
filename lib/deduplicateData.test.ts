import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deduplicateDataStore, checkForDuplicates } from './deduplicateData';
import { useDataStore } from '@/stores/dataStore';
import type { Project, Task, Section, TaskDependency } from '@/lib/schemas';

const NOW = '2026-02-14T00:00:00.000Z';

function makeProject(id: string, name = 'P'): Project {
  return { id, name, description: '', viewMode: 'list', createdAt: NOW, updatedAt: NOW };
}

function makeTask(id: string): Task {
  return {
    id, projectId: null, parentTaskId: null, sectionId: null,
    description: 'T', notes: '', assignee: '', priority: 'none',
    tags: [], dueDate: null, completed: false, completedAt: null,
    order: 0, createdAt: NOW, updatedAt: NOW,
  };
}

function makeSection(id: string): Section {
  return { id, projectId: null, name: 'S', order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW };
}

function makeDep(id: string): TaskDependency {
  return { id, blockingTaskId: crypto.randomUUID(), blockedTaskId: crypto.randomUUID(), createdAt: NOW };
}

function seedStore(overrides: Partial<{ projects: Project[]; tasks: Task[]; sections: Section[]; dependencies: TaskDependency[] }>) {
  useDataStore.setState({
    projects: overrides.projects ?? [],
    tasks: overrides.tasks ?? [],
    sections: overrides.sections ?? [],
    dependencies: overrides.dependencies ?? [],
  });
}

beforeEach(() => {
  useDataStore.setState({ projects: [], tasks: [], sections: [], dependencies: [] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('deduplicateDataStore', () => {
  it('should return 0 when no duplicates exist', () => {
    seedStore({ projects: [makeProject('a'), makeProject('b')] });
    expect(deduplicateDataStore()).toBe(0);
  });

  it('should remove duplicate projects by ID', () => {
    const p = makeProject('a', 'first');
    const pDup = makeProject('a', 'second');
    seedStore({ projects: [p, pDup] });

    const removed = deduplicateDataStore();

    expect(removed).toBe(1);
    expect(useDataStore.getState().projects).toHaveLength(1);
  });

  it('should remove duplicate tasks by ID', () => {
    const t = makeTask('t1');
    seedStore({ tasks: [t, { ...t }] });

    expect(deduplicateDataStore()).toBe(1);
    expect(useDataStore.getState().tasks).toHaveLength(1);
  });

  it('should remove duplicate sections by ID', () => {
    const s = makeSection('s1');
    seedStore({ sections: [s, { ...s }] });

    expect(deduplicateDataStore()).toBe(1);
    expect(useDataStore.getState().sections).toHaveLength(1);
  });

  it('should remove duplicate dependencies by ID', () => {
    const d = makeDep('d1');
    seedStore({ dependencies: [d, { ...d }] });

    expect(deduplicateDataStore()).toBe(1);
    expect(useDataStore.getState().dependencies).toHaveLength(1);
  });

  it('should handle duplicates across all entity types at once', () => {
    seedStore({
      projects: [makeProject('a'), makeProject('a')],
      tasks: [makeTask('t'), makeTask('t')],
      sections: [makeSection('s'), makeSection('s')],
      dependencies: [makeDep('d'), makeDep('d')],
    });

    expect(deduplicateDataStore()).toBe(4);
  });
});

describe('checkForDuplicates', () => {
  it('should return zeros when no duplicates', () => {
    seedStore({ projects: [makeProject('a')] });
    const result = checkForDuplicates();

    expect(result).toEqual({ projects: 0, tasks: 0, sections: 0, dependencies: 0, total: 0 });
  });

  it('should count duplicates per entity type', () => {
    seedStore({
      projects: [makeProject('a'), makeProject('a'), makeProject('a')],
      tasks: [makeTask('t'), makeTask('t')],
    });

    const result = checkForDuplicates();

    expect(result.projects).toBe(2);
    expect(result.tasks).toBe(1);
    expect(result.total).toBe(3);
  });

  it('should not modify the store', () => {
    const p = makeProject('a');
    seedStore({ projects: [p, { ...p }] });

    checkForDuplicates();

    expect(useDataStore.getState().projects).toHaveLength(2);
  });
});
