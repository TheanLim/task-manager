import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageProjectRepository,
  LocalStorageTaskRepository,
  LocalStorageSectionRepository,
  LocalStorageDependencyRepository,
} from '@/lib/repositories/localStorageRepositories';
import { LocalStorageAutomationRuleRepository } from '@/features/automations/repositories/localStorageAutomationRuleRepository';
import { TaskService } from '@/features/tasks/services/taskService';
import { ProjectService } from './projectService';
import type { Project, Task, Section, TaskDependency } from '@/lib/schemas';
import type { AutomationRule } from '@/features/automations/types';

const PROPERTY_CONFIG = { numRuns: 100 };

// --- Helpers ---

function makeProject(id: string): Project {
  const now = new Date().toISOString();
  return {
    id,
    name: 'Test Project',
    description: '',
    viewMode: 'list',
    createdAt: now,
    updatedAt: now,
  };
}

function makeTask(id: string, projectId: string, parentTaskId: string | null): Task {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    parentTaskId,
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
  };
}

function makeSection(id: string, projectId: string, name: string, order: number): Section {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    name,
    order,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  };
}

function makeAutomationRule(id: string, projectId: string, order: number): AutomationRule {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    name: `Rule ${order}`,
    trigger: {
      type: 'card_moved_into_section',
      sectionId: null,
    },
    action: {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Arbitraries ---

const projectArbitrary: fc.Arbitrary<Project> = fc.uuid().map((id) => makeProject(id));

/**
 * Generates a project with associated tasks (some with parent-child relationships),
 * extra sections, and dependencies between tasks.
 */
const projectWithEntitiesArbitrary: fc.Arbitrary<{
  project: Project;
  tasks: Task[];
  sections: Section[];
  deps: TaskDependency[];
}> = fc
  .tuple(
    fc.uuid(),
    fc.array(fc.uuid(), { minLength: 1, maxLength: 8 }),
    fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
  )
  .chain(([projectId, taskIds, sectionIds]) => {
    const project = makeProject(projectId);

    // First task is always a root, subsequent tasks may be children of earlier tasks
    const tasks: Task[] = taskIds.map((tid, i) => {
      const parentTaskId = i === 0 ? null : taskIds[Math.floor(Math.random() * i)];
      return makeTask(tid, projectId, parentTaskId);
    });

    // Extra sections beyond the defaults
    const sections: Section[] = sectionIds.map((sid, i) =>
      makeSection(sid, projectId, `Section ${i}`, i + 10),
    );

    // Generate some dependencies between the project's tasks
    return fc
      .array(
        fc.tuple(
          fc.integer({ min: 0, max: taskIds.length - 1 }),
          fc.integer({ min: 0, max: taskIds.length - 1 }),
          fc.uuid(),
        ),
        { minLength: 0, maxLength: 5 },
      )
      .map((pairs) => {
        const deps: TaskDependency[] = pairs
          .filter(([a, b]) => a !== b)
          .map(([a, b, depId]) => ({
            id: depId,
            blockingTaskId: taskIds[a],
            blockedTaskId: taskIds[b],
            createdAt: new Date().toISOString(),
          }));
        return { project, tasks, sections, deps };
      });
  });

describe('Feature: architecture-refactor', () => {
  let backend: LocalStorageBackend;
  let projectRepo: LocalStorageProjectRepository;
  let sectionRepo: LocalStorageSectionRepository;
  let taskRepo: LocalStorageTaskRepository;
  let depRepo: LocalStorageDependencyRepository;
  let automationRuleRepo: LocalStorageAutomationRuleRepository;
  let taskService: TaskService;
  let projectService: ProjectService;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
    projectRepo = new LocalStorageProjectRepository(backend);
    sectionRepo = new LocalStorageSectionRepository(backend);
    taskRepo = new LocalStorageTaskRepository(backend);
    depRepo = new LocalStorageDependencyRepository(backend);
    automationRuleRepo = new LocalStorageAutomationRuleRepository();
    taskService = new TaskService(taskRepo, depRepo);
    projectService = new ProjectService(projectRepo, sectionRepo, taskService, taskRepo, automationRuleRepo);
  });

  describe('Property 6: ProjectService cascade delete removes all project entities', () => {
    it('Feature: architecture-refactor, Property 6: ProjectService cascade delete removes all project entities', () => {
      /**
       * **Validates: Requirements 3.5**
       *
       * For any project with associated tasks, sections, and dependencies,
       * calling ProjectService.cascadeDelete SHALL result in zero remaining
       * tasks, sections, or dependencies belonging to that project.
       */
      fc.assert(
        fc.property(projectWithEntitiesArbitrary, ({ project, tasks, sections, deps }) => {
          // Fresh state for each iteration
          localStorage.clear();
          const b = new LocalStorageBackend();
          const pr = new LocalStorageProjectRepository(b);
          const sr = new LocalStorageSectionRepository(b);
          const tr = new LocalStorageTaskRepository(b);
          const dr = new LocalStorageDependencyRepository(b);
          const ar = new LocalStorageAutomationRuleRepository();
          const ts = new TaskService(tr, dr);
          const ps = new ProjectService(pr, sr, ts, tr, ar);

          // Create the project
          pr.create(project);

          // Create tasks
          for (const task of tasks) {
            tr.create(task);
          }

          // Create sections
          for (const section of sections) {
            sr.create(section);
          }

          // Create dependencies
          for (const dep of deps) {
            dr.create(dep);
          }

          const taskIds = new Set(tasks.map((t) => t.id));

          // Cascade delete the project
          ps.cascadeDelete(project.id);

          // Verify: zero tasks belonging to this project remain
          const remainingTasks = tr.findAll().filter((t) => t.projectId === project.id);
          expect(remainingTasks).toHaveLength(0);

          // Verify: zero sections belonging to this project remain
          const remainingSections = sr.findAll().filter((s) => s.projectId === project.id);
          expect(remainingSections).toHaveLength(0);

          // Verify: zero dependencies referencing any project task remain
          const remainingDeps = dr
            .findAll()
            .filter((d) => taskIds.has(d.blockingTaskId) || taskIds.has(d.blockedTaskId));
          expect(remainingDeps).toHaveLength(0);

          // Verify: the project itself is deleted
          expect(pr.findById(project.id)).toBeUndefined();
        }),
        PROPERTY_CONFIG,
      );
    });
  });

  describe('Property 7: ProjectService create produces default sections', () => {
    it('Feature: architecture-refactor, Property 7: ProjectService create produces default sections', () => {
      /**
       * **Validates: Requirements 3.6**
       *
       * For any valid project, calling ProjectService.createWithDefaults SHALL
       * result in exactly three sections with names "To Do", "Doing", and "Done"
       * associated with that project.
       */
      fc.assert(
        fc.property(projectArbitrary, (project) => {
          // Fresh state for each iteration
          localStorage.clear();
          const b = new LocalStorageBackend();
          const pr = new LocalStorageProjectRepository(b);
          const sr = new LocalStorageSectionRepository(b);
          const tr = new LocalStorageTaskRepository(b);
          const dr = new LocalStorageDependencyRepository(b);
          const ar = new LocalStorageAutomationRuleRepository();
          const ts = new TaskService(tr, dr);
          const ps = new ProjectService(pr, sr, ts, tr, ar);

          // Create project with defaults
          ps.createWithDefaults(project);

          // Verify: exactly 3 sections for this project
          const sections = sr.findByProjectId(project.id);
          expect(sections).toHaveLength(3);

          // Verify: section names are exactly "To Do", "Doing", "Done"
          const names = sections.map((s) => s.name).sort();
          expect(names).toEqual(['Doing', 'Done', 'To Do']);

          // Verify: all sections belong to this project
          for (const section of sections) {
            expect(section.projectId).toBe(project.id);
          }
        }),
        PROPERTY_CONFIG,
      );
    });
  });

  describe('Property 14: Cascade delete removes project rules', () => {
    it('Feature: automations-foundation, Property 14: Cascade delete removes project rules', () => {
      /**
       * **Validates: Requirements 8.3**
       *
       * For any project with associated automation rules, calling
       * ProjectService.cascadeDelete(projectId) SHALL result in zero
       * automation rules remaining for that projectId in the repository.
       */
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (projectId, ruleIds) => {
            // Fresh state for each iteration
            localStorage.clear();
            const b = new LocalStorageBackend();
            const pr = new LocalStorageProjectRepository(b);
            const sr = new LocalStorageSectionRepository(b);
            const tr = new LocalStorageTaskRepository(b);
            const dr = new LocalStorageDependencyRepository(b);
            const ar = new LocalStorageAutomationRuleRepository();
            const ts = new TaskService(tr, dr);
            const ps = new ProjectService(pr, sr, ts, tr, ar);

            // Create the project
            const project = makeProject(projectId);
            pr.create(project);

            // Create automation rules for this project
            for (let i = 0; i < ruleIds.length; i++) {
              const rule = makeAutomationRule(ruleIds[i], projectId, i);
              ar.create(rule);
            }

            // Verify rules exist before deletion
            const rulesBefore = ar.findByProjectId(projectId);
            expect(rulesBefore).toHaveLength(ruleIds.length);

            // Cascade delete the project
            ps.cascadeDelete(projectId);

            // Verify: zero automation rules remain for this project
            const rulesAfter = ar.findByProjectId(projectId);
            expect(rulesAfter).toHaveLength(0);

            // Verify: the project itself is deleted
            expect(pr.findById(projectId)).toBeUndefined();
          },
        ),
        PROPERTY_CONFIG,
      );
    });
  });
});
