import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LocalStorageBackend } from './localStorageBackend';
import {
  LocalStorageProjectRepository,
  LocalStorageTaskRepository,
  LocalStorageSectionRepository,
  LocalStorageDependencyRepository,
} from './localStorageRepositories';
import type { Project, Task, Section, TaskDependency } from '@/lib/schemas';

// Minimum 100 iterations per property
const PROPERTY_CONFIG = { numRuns: 100 };

// --- Arbitraries for generating valid entities ---

const projectArbitrary: fc.Arbitrary<Project> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string(),
  viewMode: fc.constantFrom('list' as const, 'board' as const, 'calendar' as const),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

const taskArbitrary: fc.Arbitrary<Task> = fc.record({
  id: fc.uuid(),
  projectId: fc.option(fc.uuid(), { nil: null }),
  parentTaskId: fc.option(fc.uuid(), { nil: null }),
  sectionId: fc.option(fc.string(), { nil: null }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  notes: fc.string(),
  assignee: fc.string(),
  priority: fc.constantFrom('none' as const, 'low' as const, 'medium' as const, 'high' as const),
  tags: fc.array(fc.string(), { maxLength: 5 }),
  dueDate: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  completed: fc.boolean(),
  completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  order: fc.integer(),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

const sectionArbitrary: fc.Arbitrary<Section> = fc.record({
  id: fc.string({ minLength: 1 }),
  projectId: fc.option(fc.string(), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  order: fc.integer(),
  collapsed: fc.boolean(),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

const dependencyArbitrary: fc.Arbitrary<TaskDependency> = fc.record({
  id: fc.uuid(),
  blockingTaskId: fc.uuid(),
  blockedTaskId: fc.uuid(),
  createdAt: fc.date().map((d) => d.toISOString()),
});

/**
 * Arbitrary for generating a mutation type (create, update, delete).
 * Used for Property 4 to generate sequences of mutations.
 */
const mutationTypeArbitrary = fc.constantFrom('create' as const, 'update' as const, 'delete' as const);

describe('Feature: architecture-refactor', () => {
  let backend: LocalStorageBackend;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
  });

  describe('Property 3: Repository create-read round-trip', () => {
    it('Feature: architecture-refactor, Property 3: Repository create-read round-trip — Project', () => {
      /**
       * **Validates: Requirements 2.5, 2.7, 2.8**
       *
       * For any valid Project, creating it via the ProjectRepository and then
       * calling findById with its ID SHALL return an entity equivalent to the original.
       */
      fc.assert(
        fc.property(projectArbitrary, (project) => {
          localStorage.clear();
          const b = new LocalStorageBackend();
          const repo = new LocalStorageProjectRepository(b);

          repo.create(project);
          const found = repo.findById(project.id);

          expect(found).toEqual(project);
        }),
        PROPERTY_CONFIG,
      );
    });

    it('Feature: architecture-refactor, Property 3: Repository create-read round-trip — Task', () => {
      /**
       * **Validates: Requirements 2.5, 2.7, 2.8**
       *
       * For any valid Task, creating it via the TaskRepository and then
       * calling findById with its ID SHALL return an entity equivalent to the original.
       */
      fc.assert(
        fc.property(taskArbitrary, (task) => {
          localStorage.clear();
          const b = new LocalStorageBackend();
          const repo = new LocalStorageTaskRepository(b);

          repo.create(task);
          const found = repo.findById(task.id);

          expect(found).toEqual(task);
        }),
        PROPERTY_CONFIG,
      );
    });

    it('Feature: architecture-refactor, Property 3: Repository create-read round-trip — Section', () => {
      /**
       * **Validates: Requirements 2.5, 2.7, 2.8**
       *
       * For any valid Section, creating it via the SectionRepository and then
       * calling findById with its ID SHALL return an entity equivalent to the original.
       */
      fc.assert(
        fc.property(sectionArbitrary, (section) => {
          localStorage.clear();
          const b = new LocalStorageBackend();
          const repo = new LocalStorageSectionRepository(b);

          repo.create(section);
          const found = repo.findById(section.id);

          expect(found).toEqual(section);
        }),
        PROPERTY_CONFIG,
      );
    });

    it('Feature: architecture-refactor, Property 3: Repository create-read round-trip — TaskDependency', () => {
      /**
       * **Validates: Requirements 2.5, 2.7, 2.8**
       *
       * For any valid TaskDependency, creating it via the DependencyRepository and then
       * calling findById with its ID SHALL return an entity equivalent to the original.
       */
      fc.assert(
        fc.property(dependencyArbitrary, (dep) => {
          localStorage.clear();
          const b = new LocalStorageBackend();
          const repo = new LocalStorageDependencyRepository(b);

          repo.create(dep);
          const found = repo.findById(dep.id);

          expect(found).toEqual(dep);
        }),
        PROPERTY_CONFIG,
      );
    });
  });

  describe('Property 4: Repository subscriber notification', () => {
    it('Feature: architecture-refactor, Property 4: Repository subscriber notification — Project', () => {
      /**
       * **Validates: Requirements 2.6**
       *
       * For any sequence of N mutations (create, update, delete) on a ProjectRepository
       * with a registered subscriber, the subscriber callback SHALL be invoked exactly N times.
       */
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(mutationTypeArbitrary, projectArbitrary),
            { minLength: 1, maxLength: 10 },
          ),
          (mutations) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageProjectRepository(b);

            let callCount = 0;
            repo.subscribe(() => {
              callCount++;
            });

            // Seed with first entity so update/delete have something to work with
            const seedProject = mutations[0][1];
            repo.create(seedProject);
            callCount = 0; // Reset after seed

            let expectedCount = 0;
            for (const [mutationType, project] of mutations) {
              switch (mutationType) {
                case 'create':
                  repo.create(project);
                  expectedCount++;
                  break;
                case 'update':
                  repo.update(seedProject.id, { name: project.name });
                  expectedCount++;
                  break;
                case 'delete':
                  repo.delete(project.id);
                  expectedCount++;
                  break;
              }
            }

            expect(callCount).toBe(expectedCount);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('Feature: architecture-refactor, Property 4: Repository subscriber notification — Task', () => {
      /**
       * **Validates: Requirements 2.6**
       *
       * For any sequence of N mutations on a TaskRepository with a registered subscriber,
       * the subscriber callback SHALL be invoked exactly N times.
       */
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(mutationTypeArbitrary, taskArbitrary),
            { minLength: 1, maxLength: 10 },
          ),
          (mutations) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageTaskRepository(b);

            let callCount = 0;
            repo.subscribe(() => {
              callCount++;
            });

            const seedTask = mutations[0][1];
            repo.create(seedTask);
            callCount = 0;

            let expectedCount = 0;
            for (const [mutationType, task] of mutations) {
              switch (mutationType) {
                case 'create':
                  repo.create(task);
                  expectedCount++;
                  break;
                case 'update':
                  repo.update(seedTask.id, { description: task.description });
                  expectedCount++;
                  break;
                case 'delete':
                  repo.delete(task.id);
                  expectedCount++;
                  break;
              }
            }

            expect(callCount).toBe(expectedCount);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('Feature: architecture-refactor, Property 4: Repository subscriber notification — Section', () => {
      /**
       * **Validates: Requirements 2.6**
       *
       * For any sequence of N mutations on a SectionRepository with a registered subscriber,
       * the subscriber callback SHALL be invoked exactly N times.
       */
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(mutationTypeArbitrary, sectionArbitrary),
            { minLength: 1, maxLength: 10 },
          ),
          (mutations) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageSectionRepository(b);

            let callCount = 0;
            repo.subscribe(() => {
              callCount++;
            });

            const seedSection = mutations[0][1];
            repo.create(seedSection);
            callCount = 0;

            let expectedCount = 0;
            for (const [mutationType, section] of mutations) {
              switch (mutationType) {
                case 'create':
                  repo.create(section);
                  expectedCount++;
                  break;
                case 'update':
                  repo.update(seedSection.id, { name: section.name });
                  expectedCount++;
                  break;
                case 'delete':
                  repo.delete(section.id);
                  expectedCount++;
                  break;
              }
            }

            expect(callCount).toBe(expectedCount);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('Feature: architecture-refactor, Property 4: Repository subscriber notification — TaskDependency', () => {
      /**
       * **Validates: Requirements 2.6**
       *
       * For any sequence of N mutations on a DependencyRepository with a registered subscriber,
       * the subscriber callback SHALL be invoked exactly N times.
       */
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(mutationTypeArbitrary, dependencyArbitrary),
            { minLength: 1, maxLength: 10 },
          ),
          (mutations) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageDependencyRepository(b);

            let callCount = 0;
            repo.subscribe(() => {
              callCount++;
            });

            const seedDep = mutations[0][1];
            repo.create(seedDep);
            callCount = 0;

            let expectedCount = 0;
            for (const [mutationType, dep] of mutations) {
              switch (mutationType) {
                case 'create':
                  repo.create(dep);
                  expectedCount++;
                  break;
                case 'update':
                  repo.update(seedDep.id, { blockingTaskId: dep.blockingTaskId });
                  expectedCount++;
                  break;
                case 'delete':
                  repo.delete(dep.id);
                  expectedCount++;
                  break;
              }
            }

            expect(callCount).toBe(expectedCount);
          },
        ),
        PROPERTY_CONFIG,
      );
    });
  });

  describe('Property 5: Repository replaceAll round-trip', () => {
    it('replaceAll overwrites all projects and is readable via findAll', () => {
      fc.assert(
        fc.property(
          fc.array(projectArbitrary, { minLength: 0, maxLength: 10 }),
          (projects) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageProjectRepository(b);

            // Seed with some data first
            repo.create({ ...projects[0] ?? { id: crypto.randomUUID(), name: 'seed', description: '', viewMode: 'list' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });

            repo.replaceAll(projects);
            expect(repo.findAll()).toEqual(projects);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('replaceAll overwrites all tasks and is readable via findAll', () => {
      fc.assert(
        fc.property(
          fc.array(taskArbitrary, { minLength: 0, maxLength: 10 }),
          (tasks) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageTaskRepository(b);

            repo.replaceAll(tasks);
            expect(repo.findAll()).toEqual(tasks);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('replaceAll overwrites all sections and is readable via findAll', () => {
      fc.assert(
        fc.property(
          fc.array(sectionArbitrary, { minLength: 0, maxLength: 10 }),
          (sections) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageSectionRepository(b);

            repo.replaceAll(sections);
            expect(repo.findAll()).toEqual(sections);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('replaceAll overwrites all dependencies and is readable via findAll', () => {
      fc.assert(
        fc.property(
          fc.array(dependencyArbitrary, { minLength: 0, maxLength: 10 }),
          (deps) => {
            localStorage.clear();
            const b = new LocalStorageBackend();
            const repo = new LocalStorageDependencyRepository(b);

            repo.replaceAll(deps);
            expect(repo.findAll()).toEqual(deps);
          },
        ),
        PROPERTY_CONFIG,
      );
    });

    it('replaceAll notifies subscribers exactly once', () => {
      localStorage.clear();
      const b = new LocalStorageBackend();
      const repo = new LocalStorageProjectRepository(b);

      let callCount = 0;
      repo.subscribe(() => { callCount++; });

      repo.replaceAll([]);
      expect(callCount).toBe(1);
    });
  });
});
