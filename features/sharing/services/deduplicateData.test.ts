import { describe, it, expect } from 'vitest';
import { deduplicateEntities, countDuplicates } from './deduplicateData';
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

const empty = { projects: [] as Project[], tasks: [] as Task[], sections: [] as Section[], dependencies: [] as TaskDependency[] };

describe('deduplicateEntities', () => {
  it('should return 0 when no duplicates exist', () => {
    const result = deduplicateEntities({ ...empty, projects: [makeProject('a'), makeProject('b')] });
    expect(result.removedCount).toBe(0);
  });

  it('should remove duplicate projects by ID', () => {
    const p = makeProject('a', 'first');
    const pDup = makeProject('a', 'second');
    const result = deduplicateEntities({ ...empty, projects: [p, pDup] });

    expect(result.removedCount).toBe(1);
    expect(result.deduplicated.projects).toHaveLength(1);
  });

  it('should remove duplicate tasks by ID', () => {
    const t = makeTask('t1');
    const result = deduplicateEntities({ ...empty, tasks: [t, { ...t }] });

    expect(result.removedCount).toBe(1);
    expect(result.deduplicated.tasks).toHaveLength(1);
  });

  it('should remove duplicate sections by ID', () => {
    const s = makeSection('s1');
    const result = deduplicateEntities({ ...empty, sections: [s, { ...s }] });

    expect(result.removedCount).toBe(1);
    expect(result.deduplicated.sections).toHaveLength(1);
  });

  it('should remove duplicate dependencies by ID', () => {
    const d = makeDep('d1');
    const result = deduplicateEntities({ ...empty, dependencies: [d, { ...d }] });

    expect(result.removedCount).toBe(1);
    expect(result.deduplicated.dependencies).toHaveLength(1);
  });

  it('should handle duplicates across all entity types at once', () => {
    const result = deduplicateEntities({
      projects: [makeProject('a'), makeProject('a')],
      tasks: [makeTask('t'), makeTask('t')],
      sections: [makeSection('s'), makeSection('s')],
      dependencies: [makeDep('d'), makeDep('d')],
    });

    expect(result.removedCount).toBe(4);
  });

  it('should not mutate the input arrays', () => {
    const projects = [makeProject('a'), makeProject('a')];
    const original = [...projects];
    deduplicateEntities({ ...empty, projects });
    expect(projects).toEqual(original);
  });
});

describe('countDuplicates', () => {
  it('should return zeros when no duplicates', () => {
    const result = countDuplicates({ ...empty, projects: [makeProject('a')] });
    expect(result).toEqual({ projects: 0, tasks: 0, sections: 0, dependencies: 0, total: 0 });
  });

  it('should count duplicates per entity type', () => {
    const result = countDuplicates({
      ...empty,
      projects: [makeProject('a'), makeProject('a'), makeProject('a')],
      tasks: [makeTask('t'), makeTask('t')],
    });

    expect(result.projects).toBe(2);
    expect(result.tasks).toBe(1);
    expect(result.total).toBe(3);
  });
});
