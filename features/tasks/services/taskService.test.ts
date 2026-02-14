import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageTaskRepository,
  LocalStorageDependencyRepository,
} from '@/lib/repositories/localStorageRepositories';
import { TaskService } from './taskService';
import type { Task, TaskDependency } from '@/lib/schemas';

const PROPERTY_CONFIG = { numRuns: 100 };

// --- Arbitraries ---

/** Generate a valid task with a given id, projectId, and parentTaskId. */
function makeTask(id: string, projectId: string | null, parentTaskId: string | null): Task {
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

/**
 * Arbitrary that generates a task tree: a root task with arbitrarily nested subtasks.
 * Returns { root, allTasks } where allTasks is a flat list of all tasks in the tree.
 */
const taskTreeArbitrary: fc.Arbitrary<{ projectId: string; root: Task; allTasks: Task[] }> = fc
  .tuple(fc.uuid(), fc.uuid())
  .chain(([projectId, rootId]) => {
    const root = makeTask(rootId, projectId, null);

    // Generate a tree of subtasks using a recursive approach
    // We generate layers: each layer has children referencing parents from the previous layer
    return fc
      .array(
        fc.tuple(
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }), // number of children per parent (capped)
        ),
        { minLength: 0, maxLength: 3 }, // 0-3 layers of depth
      )
      .map((layers) => {
        const allTasks: Task[] = [root];
        let currentParents = [root];

        for (const [baseId, childCount] of layers) {
          if (currentParents.length === 0) break;
          const nextParents: Task[] = [];
          // For each parent in the current layer, create some children
          for (let pi = 0; pi < currentParents.length; pi++) {
            const parent = currentParents[pi];
            const numChildren = Math.min(childCount, 3); // cap to keep test fast
            for (let ci = 0; ci < numChildren; ci++) {
              // Derive a unique ID from baseId + indices
              const childId = `${baseId.slice(0, 24)}${String(pi).padStart(4, '0')}${String(ci).padStart(4, '0')}xx`;
              // Ensure it's a valid-ish UUID format
              const formattedId = [
                childId.slice(0, 8),
                childId.slice(8, 12),
                '4' + childId.slice(13, 16),
                '8' + childId.slice(17, 20),
                childId.slice(20, 32).padEnd(12, '0'),
              ].join('-');
              const child = makeTask(formattedId, projectId, parent.id);
              allTasks.push(child);
              nextParents.push(child);
            }
          }
          currentParents = nextParents;
        }

        return { projectId, root, allTasks };
      });
  });

/**
 * Arbitrary for generating dependencies between tasks in a tree.
 * Given a list of task IDs, generates some dependencies between them.
 */
function dependenciesArbitrary(taskIds: string[]): fc.Arbitrary<TaskDependency[]> {
  if (taskIds.length < 2) return fc.constant([]);

  return fc
    .array(
      fc.tuple(
        fc.integer({ min: 0, max: taskIds.length - 1 }),
        fc.integer({ min: 0, max: taskIds.length - 1 }),
        fc.uuid(),
      ),
      { minLength: 0, maxLength: 5 },
    )
    .map((pairs) =>
      pairs
        .filter(([a, b]) => a !== b)
        .map(([a, b, depId]) => ({
          id: depId,
          blockingTaskId: taskIds[a],
          blockedTaskId: taskIds[b],
          createdAt: new Date().toISOString(),
        })),
    );
}

describe('Feature: architecture-refactor', () => {
  let backend: LocalStorageBackend;
  let taskRepo: LocalStorageTaskRepository;
  let depRepo: LocalStorageDependencyRepository;
  let taskService: TaskService;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
    taskRepo = new LocalStorageTaskRepository(backend);
    depRepo = new LocalStorageDependencyRepository(backend);
    taskService = new TaskService(taskRepo, depRepo);
  });

  describe('Property 5: TaskService cascade delete removes all descendants', () => {
    it('Feature: architecture-refactor, Property 5: TaskService cascade delete removes all descendants', () => {
      /**
       * **Validates: Requirements 3.4**
       *
       * For any task tree (a task with arbitrarily nested subtasks), calling
       * TaskService.cascadeDelete on the root task SHALL result in zero remaining
       * tasks from that tree and zero dependencies referencing any deleted task.
       */
      fc.assert(
        fc.property(
          taskTreeArbitrary.chain((tree) =>
            dependenciesArbitrary(tree.allTasks.map((t) => t.id)).map((deps) => ({
              ...tree,
              deps,
            })),
          ),
          ({ root, allTasks, deps }) => {
            // Fresh state for each iteration
            localStorage.clear();
            const b = new LocalStorageBackend();
            const tr = new LocalStorageTaskRepository(b);
            const dr = new LocalStorageDependencyRepository(b);
            const svc = new TaskService(tr, dr);

            // Create all tasks in the tree
            for (const task of allTasks) {
              tr.create(task);
            }

            // Create dependencies
            for (const dep of deps) {
              dr.create(dep);
            }

            const treeIds = new Set(allTasks.map((t) => t.id));

            // Cascade delete the root
            svc.cascadeDelete(root.id);

            // Verify: zero tasks from the tree remain
            const remainingTasks = tr.findAll();
            const remainingTreeTasks = remainingTasks.filter((t) => treeIds.has(t.id));
            expect(remainingTreeTasks).toHaveLength(0);

            // Verify: zero dependencies reference any deleted task
            const remainingDeps = dr.findAll();
            const orphanedDeps = remainingDeps.filter(
              (d) => treeIds.has(d.blockingTaskId) || treeIds.has(d.blockedTaskId),
            );
            expect(orphanedDeps).toHaveLength(0);
          },
        ),
        PROPERTY_CONFIG,
      );
    });
  });
});
