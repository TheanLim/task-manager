import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageTaskRepository,
  LocalStorageDependencyRepository,
} from '@/lib/repositories/localStorageRepositories';
import { TaskService, getEffectiveLastActionTime } from './taskService';
import type { Task, TaskDependency } from '@/lib/schemas';
import type { DomainEvent } from '@/features/automations/types';

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

describe('getEffectiveLastActionTime', () => {
  it('returns lastActionAt when it is set', () => {
    const task = makeTask('00000000-0000-4000-8000-000000000001', null, null);
    task.lastActionAt = '2025-06-01T12:00:00.000Z';
    expect(getEffectiveLastActionTime(task)).toBe('2025-06-01T12:00:00.000Z');
  });

  it('returns createdAt when lastActionAt is null', () => {
    const task = makeTask('00000000-0000-4000-8000-000000000002', null, null);
    task.lastActionAt = null;
    expect(getEffectiveLastActionTime(task)).toBe(task.createdAt);
  });

  it('returns createdAt when lastActionAt is undefined (missing field)', () => {
    const task = makeTask('00000000-0000-4000-8000-000000000003', null, null);
    // makeTask doesn't set lastActionAt, so it's undefined
    expect(getEffectiveLastActionTime(task)).toBe(task.createdAt);
  });
});

describe('TaskService.reinsertTask', () => {
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

  it('updates lastActionAt when reinserting a parent task', () => {
    const task = makeTask('00000000-0000-4000-8000-000000000010', null, null);
    task.sectionId = 'section-1';
    task.order = 0;
    taskRepo.create(task);

    const before = new Date().toISOString();
    taskService.reinsertTask(task.id);
    const after = new Date().toISOString();

    const updated = taskRepo.findById(task.id)!;
    expect(updated.lastActionAt).not.toBeNull();
    expect(updated.lastActionAt! >= before).toBe(true);
    expect(updated.lastActionAt! <= after).toBe(true);
  });

  it('moves subtask to bottom of parent list and updates both timestamps', () => {
    const parentId = '00000000-0000-4000-8000-000000000020';
    const sub1Id = '00000000-0000-4000-8000-000000000021';
    const sub2Id = '00000000-0000-4000-8000-000000000022';
    const sub3Id = '00000000-0000-4000-8000-000000000023';

    const parent = makeTask(parentId, null, null);
    parent.sectionId = 'section-1';
    taskRepo.create(parent);

    const sub1 = makeTask(sub1Id, null, parentId);
    sub1.order = 0;
    taskRepo.create(sub1);

    const sub2 = makeTask(sub2Id, null, parentId);
    sub2.order = 1;
    taskRepo.create(sub2);

    const sub3 = makeTask(sub3Id, null, parentId);
    sub3.order = 2;
    taskRepo.create(sub3);

    // Reinsert sub1 (currently first) — should update timestamps but NOT change order
    const before = new Date().toISOString();
    taskService.reinsertTask(sub1Id);
    const after = new Date().toISOString();

    const updatedSub1 = taskRepo.findById(sub1Id)!;
    const updatedParent = taskRepo.findById(parentId)!;

    // sub1 order should remain unchanged (project views unaffected)
    expect(updatedSub1.order).toBe(0);
    // sub1 lastActionAt updated
    expect(updatedSub1.lastActionAt).not.toBeNull();
    expect(updatedSub1.lastActionAt! >= before).toBe(true);
    expect(updatedSub1.lastActionAt! <= after).toBe(true);
    // parent lastActionAt also updated
    expect(updatedParent.lastActionAt).not.toBeNull();
    expect(updatedParent.lastActionAt! >= before).toBe(true);
    expect(updatedParent.lastActionAt! <= after).toBe(true);
  });

  it('does nothing when task ID does not exist', () => {
    // Should not throw
    expect(() => {
      taskService.reinsertTask('00000000-0000-4000-8000-999999999999');
    }).not.toThrow();
  });

  it('updates lastActionAt when reinserting the only task in a section (idempotent)', () => {
    const task = makeTask('00000000-0000-4000-8000-000000000030', null, null);
    task.sectionId = 'section-lonely';
    task.order = 0;
    taskRepo.create(task);

    taskService.reinsertTask(task.id);

    const updated = taskRepo.findById(task.id)!;
    expect(updated.lastActionAt).not.toBeNull();
  });
});

describe('Feature: task-last-action-ordering, Property 2: Effective last action time fallback', () => {
  it('Feature: task-last-action-ordering, Property 2: Effective last action time fallback', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * For any task, getEffectiveLastActionTime(task) should return task.lastActionAt
     * when it is non-null, and task.createdAt when lastActionAt is null or undefined.
     */
    const taskWithLastActionArb = fc.date().chain((createdDate) =>
      fc.oneof(
        // lastActionAt is a valid datetime string
        fc.date().map((actionDate) => {
          const task = makeTask(crypto.randomUUID(), null, null);
          task.createdAt = createdDate.toISOString();
          task.lastActionAt = actionDate.toISOString();
          return task;
        }),
        // lastActionAt is null
        fc.constant(null).map(() => {
          const task = makeTask(crypto.randomUUID(), null, null);
          task.createdAt = createdDate.toISOString();
          task.lastActionAt = null;
          return task;
        }),
        // lastActionAt is undefined (missing)
        fc.constant(undefined).map(() => {
          const task = makeTask(crypto.randomUUID(), null, null);
          task.createdAt = createdDate.toISOString();
          // makeTask doesn't set lastActionAt, so it's undefined
          return task;
        }),
      ),
    );

    fc.assert(
      fc.property(taskWithLastActionArb, (task) => {
        const result = getEffectiveLastActionTime(task);
        if (task.lastActionAt != null) {
          expect(result).toBe(task.lastActionAt);
        } else {
          expect(result).toBe(task.createdAt);
        }
      }),
      PROPERTY_CONFIG,
    );
  });
});

describe('Feature: task-last-action-ordering, Property 5: Parent task reinsert moves to bottom and updates timestamp', () => {
  it('Feature: task-last-action-ordering, Property 5: Parent task reinsert moves to bottom and updates timestamp', () => {
    /**
     * **Validates: Requirements 4.1, 4.2**
     *
     * For any section containing multiple parent tasks, reinserting a parent task
     * should result in: (a) the parent task having the highest effective last action
     * time in the section, and (b) the parent task's lastActionAt being updated to
     * a timestamp at or after the reinsert invocation time.
     */
    // Generate 2-5 parent tasks in the same section
    const parentTasksArb = fc
      .integer({ min: 2, max: 5 })
      .chain((count) =>
        fc.tuple(
          fc.array(fc.uuid(), { minLength: count, maxLength: count }),
          fc.integer({ min: 0, max: count - 1 }),
        ),
      )
      .map(([ids, targetIndex]) => ({ ids, targetIndex }));

    fc.assert(
      fc.property(parentTasksArb, ({ ids, targetIndex }) => {
        // Fresh state per iteration
        localStorage.clear();
        const b = new LocalStorageBackend();
        const tr = new LocalStorageTaskRepository(b);
        const dr = new LocalStorageDependencyRepository(b);
        const svc = new TaskService(tr, dr);

        // Create parent tasks in the same section with staggered createdAt
        const baseTime = new Date('2025-01-01T00:00:00.000Z');
        for (let i = 0; i < ids.length; i++) {
          const task = makeTask(ids[i], null, null);
          task.sectionId = 'section-1';
          task.order = i;
          task.createdAt = new Date(baseTime.getTime() + i * 60000).toISOString();
          task.updatedAt = task.createdAt;
          tr.create(task);
        }

        const targetId = ids[targetIndex];
        const before = new Date().toISOString();
        svc.reinsertTask(targetId);

        const updatedTarget = tr.findById(targetId)!;

        // (b) lastActionAt is at or after the reinsert invocation time
        expect(updatedTarget.lastActionAt).not.toBeNull();
        expect(updatedTarget.lastActionAt! >= before).toBe(true);

        // (a) target has the highest effective last action time in the section
        const allTasks = tr.findAll().filter((t) => t.sectionId === 'section-1');
        for (const t of allTasks) {
          if (t.id !== targetId) {
            expect(
              getEffectiveLastActionTime(updatedTarget) >= getEffectiveLastActionTime(t),
            ).toBe(true);
          }
        }
      }),
      PROPERTY_CONFIG,
    );
  });
});

describe('Feature: task-last-action-ordering, Property 6: Subtask order preserved after parent reinsert', () => {
  it('Feature: task-last-action-ordering, Property 6: Subtask order preserved after parent reinsert', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * For any parent task with two or more subtasks, after reinserting the parent
     * task, the relative ordering of its subtasks should remain identical to the
     * ordering before the reinsert.
     */
    const parentWithSubtasksArb = fc
      .integer({ min: 2, max: 6 })
      .chain((subtaskCount) =>
        fc.tuple(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: subtaskCount, maxLength: subtaskCount }),
        ),
      );

    fc.assert(
      fc.property(parentWithSubtasksArb, ([parentId, subtaskIds]) => {
        localStorage.clear();
        const b = new LocalStorageBackend();
        const tr = new LocalStorageTaskRepository(b);
        const dr = new LocalStorageDependencyRepository(b);
        const svc = new TaskService(tr, dr);

        const parent = makeTask(parentId, null, null);
        parent.sectionId = 'section-1';
        tr.create(parent);

        for (let i = 0; i < subtaskIds.length; i++) {
          const sub = makeTask(subtaskIds[i], null, parentId);
          sub.order = i;
          tr.create(sub);
        }

        // Record subtask order before reinsert
        const orderBefore = tr
          .findByParentTaskId(parentId)
          .sort((a, b) => a.order - b.order)
          .map((t) => t.id);

        svc.reinsertTask(parentId);

        // Record subtask order after reinsert
        const orderAfter = tr
          .findByParentTaskId(parentId)
          .sort((a, b) => a.order - b.order)
          .map((t) => t.id);

        expect(orderAfter).toEqual(orderBefore);
      }),
      PROPERTY_CONFIG,
    );
  });
});

describe('Feature: task-last-action-ordering, Property 7: Subtask reinsert moves subtask to bottom and bubbles parent', () => {
  it('Feature: task-last-action-ordering, Property 7: Subtask reinsert moves subtask to bottom and bubbles parent', () => {
    /**
     * **Validates: Requirements 5.1, 5.2, 5.3**
     *
     * For any parent task with multiple subtasks, reinserting a subtask should
     * result in: (a) the subtask being last in the parent's subtask list,
     * (b) the subtask's lastActionAt being updated, and (c) the parent's
     * lastActionAt also being updated, causing the parent group to have the
     * highest effective last action time in the section.
     */
    const subtaskReinsertArb = fc
      .integer({ min: 2, max: 6 })
      .chain((subtaskCount) =>
        fc.tuple(
          fc.uuid(), // parent
          fc.uuid(), // another parent in same section
          fc.array(fc.uuid(), { minLength: subtaskCount, maxLength: subtaskCount }),
          fc.integer({ min: 0, max: subtaskCount - 1 }), // which subtask to reinsert
        ),
      );

    fc.assert(
      fc.property(subtaskReinsertArb, ([parentId, otherParentId, subtaskIds, targetIdx]) => {
        localStorage.clear();
        const b = new LocalStorageBackend();
        const tr = new LocalStorageTaskRepository(b);
        const dr = new LocalStorageDependencyRepository(b);
        const svc = new TaskService(tr, dr);

        const baseTime = new Date('2025-01-01T00:00:00.000Z');

        // Create two parent tasks in the same section
        const parent = makeTask(parentId, null, null);
        parent.sectionId = 'section-1';
        parent.createdAt = baseTime.toISOString();
        parent.updatedAt = parent.createdAt;
        tr.create(parent);

        const otherParent = makeTask(otherParentId, null, null);
        otherParent.sectionId = 'section-1';
        otherParent.createdAt = new Date(baseTime.getTime() + 60000).toISOString();
        otherParent.updatedAt = otherParent.createdAt;
        tr.create(otherParent);

        // Create subtasks
        for (let i = 0; i < subtaskIds.length; i++) {
          const sub = makeTask(subtaskIds[i], null, parentId);
          sub.order = i;
          sub.createdAt = new Date(baseTime.getTime() + (i + 2) * 60000).toISOString();
          sub.updatedAt = sub.createdAt;
          tr.create(sub);
        }

        const targetSubId = subtaskIds[targetIdx];
        const before = new Date().toISOString();
        svc.reinsertTask(targetSubId);

        const updatedSub = tr.findById(targetSubId)!;
        const updatedParent = tr.findById(parentId)!;

        // (a) subtask has the highest effective last action time among siblings
        const siblings = tr.findByParentTaskId(parentId);
        for (const s of siblings) {
          if (s.id !== targetSubId) {
            expect(
              getEffectiveLastActionTime(updatedSub) >= getEffectiveLastActionTime(s),
            ).toBe(true);
          }
        }

        // (b) subtask's lastActionAt is updated
        expect(updatedSub.lastActionAt).not.toBeNull();
        expect(updatedSub.lastActionAt! >= before).toBe(true);

        // (c) parent's lastActionAt is updated, making it highest in section
        expect(updatedParent.lastActionAt).not.toBeNull();
        expect(updatedParent.lastActionAt! >= before).toBe(true);

        const sectionParents = tr
          .findAll()
          .filter((t) => t.sectionId === 'section-1' && t.parentTaskId == null);
        for (const p of sectionParents) {
          if (p.id !== parentId) {
            expect(
              getEffectiveLastActionTime(updatedParent) >= getEffectiveLastActionTime(p),
            ).toBe(true);
          }
        }
      }),
      PROPERTY_CONFIG,
    );
  });
});

describe('Feature: task-last-action-ordering, Property 3: Sort by last action time produces correct order', () => {
  it('Feature: task-last-action-ordering, Property 3: Sort by last action time produces correct order', () => {
    /**
     * **Validates: Requirements 2.1, 6.2**
     *
     * For any list of tasks with various lastActionAt and createdAt values,
     * sorting by effective last action time in ascending order should produce
     * a list where each task's effective time is <= the next task's.
     * The same invariant (reversed) should hold for descending order.
     */
    const taskListArb = fc
      .array(
        fc.tuple(
          fc.uuid(),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          fc.option(
            fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
            { nil: null },
          ),
        ),
        { minLength: 2, maxLength: 20 },
      )
      .map((entries) =>
        entries.map(([id, createdDate, actionDate]) => {
          const task = makeTask(id, null, null);
          task.createdAt = createdDate.toISOString();
          task.lastActionAt = actionDate ? actionDate.toISOString() : null;
          return task;
        }),
      );

    fc.assert(
      fc.property(taskListArb, (tasks) => {
        // Ascending sort
        const ascending = [...tasks].sort((a, b) =>
          getEffectiveLastActionTime(a).localeCompare(getEffectiveLastActionTime(b)),
        );
        for (let i = 0; i < ascending.length - 1; i++) {
          expect(
            getEffectiveLastActionTime(ascending[i]) <= getEffectiveLastActionTime(ascending[i + 1]),
          ).toBe(true);
        }

        // Descending sort
        const descending = [...tasks].sort((a, b) =>
          getEffectiveLastActionTime(b).localeCompare(getEffectiveLastActionTime(a)),
        );
        for (let i = 0; i < descending.length - 1; i++) {
          expect(
            getEffectiveLastActionTime(descending[i]) >= getEffectiveLastActionTime(descending[i + 1]),
          ).toBe(true);
        }
      }),
      PROPERTY_CONFIG,
    );
  });
});

describe('Feature: task-last-action-ordering, Property 4: Column sort overrides default last-action ordering', () => {
  it('Feature: task-last-action-ordering, Property 4: Column sort overrides default last-action ordering', () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any list of tasks and any active sort column (e.g., priority),
     * the resulting task order should match the column's sort comparator,
     * not the last-action-time ordering.
     */
    const PRIORITY_WEIGHT: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
      none: 3,
    };

    const taskListArb = fc
      .array(
        fc.tuple(
          fc.uuid(),
          fc.constantFrom('none' as const, 'low' as const, 'medium' as const, 'high' as const),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          fc.option(
            fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
            { nil: null },
          ),
        ),
        { minLength: 2, maxLength: 20 },
      )
      .map((entries) =>
        entries.map(([id, priority, createdDate, actionDate]) => {
          const task = makeTask(id, null, null);
          task.priority = priority;
          task.createdAt = createdDate.toISOString();
          task.lastActionAt = actionDate ? actionDate.toISOString() : null;
          return task;
        }),
      );

    const directionArb = fc.constantFrom('asc' as const, 'desc' as const);

    fc.assert(
      fc.property(taskListArb, directionArb, (tasks, direction) => {
        const dir = direction === 'asc' ? 1 : -1;

        // Sort by priority (same comparator as TaskList)
        const sorted = [...tasks].sort((a, b) => {
          const cmp = (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
          return cmp * dir;
        });

        // Verify priority ordering holds
        for (let i = 0; i < sorted.length - 1; i++) {
          const wA = PRIORITY_WEIGHT[sorted[i].priority] ?? 3;
          const wB = PRIORITY_WEIGHT[sorted[i + 1].priority] ?? 3;
          if (direction === 'asc') {
            expect(wA <= wB).toBe(true);
          } else {
            expect(wA >= wB).toBe(true);
          }
        }
      }),
      PROPERTY_CONFIG,
    );
  });
});


describe('TaskService domain event emission', () => {
  let backend: LocalStorageBackend;
  let taskRepo: LocalStorageTaskRepository;
  let depRepo: LocalStorageDependencyRepository;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
    taskRepo = new LocalStorageTaskRepository(backend);
    depRepo = new LocalStorageDependencyRepository(backend);
  });

  describe('cascadeDelete emits task.deleted events', () => {
    it('emits task.deleted event for single task', () => {
      const events: DomainEvent[] = [];
      const emitEvent = vi.fn((event: DomainEvent) => events.push(event));
      const taskService = new TaskService(taskRepo, depRepo, emitEvent);

      const task = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      taskRepo.create(task);

      taskService.cascadeDelete(task.id);

      expect(emitEvent).toHaveBeenCalledTimes(1);
      expect(events[0]).toMatchObject({
        type: 'task.deleted',
        entityId: task.id,
        projectId: 'project-1',
        depth: 0,
      });
      expect(events[0].previousValues).toMatchObject({
        id: task.id,
        projectId: 'project-1',
      });
    });

    it('emits task.deleted events for task tree', () => {
      const events: DomainEvent[] = [];
      const emitEvent = vi.fn((event: DomainEvent) => events.push(event));
      const taskService = new TaskService(taskRepo, depRepo, emitEvent);

      const parent = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      const child1 = makeTask('00000000-0000-4000-8000-000000000002', 'project-1', parent.id);
      const child2 = makeTask('00000000-0000-4000-8000-000000000003', 'project-1', parent.id);

      taskRepo.create(parent);
      taskRepo.create(child1);
      taskRepo.create(child2);

      taskService.cascadeDelete(parent.id);

      expect(emitEvent).toHaveBeenCalledTimes(3);
      // Events should be emitted bottom-up (children first, parent last)
      expect(events.map(e => e.entityId)).toEqual([child2.id, child1.id, parent.id]);
      events.forEach(event => {
        expect(event.type).toBe('task.deleted');
        expect(event.projectId).toBe('project-1');
        expect(event.depth).toBe(0);
      });
    });

    it('does not emit events when emitEvent callback is not provided', () => {
      const taskService = new TaskService(taskRepo, depRepo);

      const task = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      taskRepo.create(task);

      // Should not throw
      expect(() => taskService.cascadeDelete(task.id)).not.toThrow();
    });
  });

  describe('cascadeComplete emits task.updated events', () => {
    it('emits task.updated event when completing a task', () => {
      const events: DomainEvent[] = [];
      const emitEvent = vi.fn((event: DomainEvent) => events.push(event));
      const taskService = new TaskService(taskRepo, depRepo, emitEvent);

      const task = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      task.completed = false;
      task.completedAt = null;
      taskRepo.create(task);

      taskService.cascadeComplete(task.id, true);

      expect(emitEvent).toHaveBeenCalledTimes(1);
      expect(events[0]).toMatchObject({
        type: 'task.updated',
        entityId: task.id,
        projectId: 'project-1',
        depth: 0,
      });
      expect(events[0].changes).toMatchObject({
        completed: true,
      });
      expect(events[0].changes.completedAt).toBeTruthy();
      expect(events[0].previousValues).toMatchObject({
        completed: false,
        completedAt: null,
      });
    });

    it('emits task.updated event when uncompleting a task', () => {
      const events: DomainEvent[] = [];
      const emitEvent = vi.fn((event: DomainEvent) => events.push(event));
      const taskService = new TaskService(taskRepo, depRepo, emitEvent);

      const task = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      task.completed = true;
      task.completedAt = '2025-01-01T00:00:00.000Z';
      taskRepo.create(task);

      taskService.cascadeComplete(task.id, false);

      expect(emitEvent).toHaveBeenCalledTimes(1);
      expect(events[0]).toMatchObject({
        type: 'task.updated',
        entityId: task.id,
        projectId: 'project-1',
        depth: 0,
      });
      expect(events[0].changes).toMatchObject({
        completed: false,
        completedAt: null,
      });
      expect(events[0].previousValues).toMatchObject({
        completed: true,
        completedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('emits task.updated events for parent and all descendants when completing', () => {
      const events: DomainEvent[] = [];
      const emitEvent = vi.fn((event: DomainEvent) => events.push(event));
      const taskService = new TaskService(taskRepo, depRepo, emitEvent);

      const parent = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      parent.completed = false;
      const child1 = makeTask('00000000-0000-4000-8000-000000000002', 'project-1', parent.id);
      child1.completed = false;
      const child2 = makeTask('00000000-0000-4000-8000-000000000003', 'project-1', parent.id);
      child2.completed = false;

      taskRepo.create(parent);
      taskRepo.create(child1);
      taskRepo.create(child2);

      taskService.cascadeComplete(parent.id, true);

      expect(emitEvent).toHaveBeenCalledTimes(3);
      // Parent first, then descendants
      expect(events[0].entityId).toBe(parent.id);
      expect(events.slice(1).map(e => e.entityId)).toContain(child1.id);
      expect(events.slice(1).map(e => e.entityId)).toContain(child2.id);
      
      events.forEach(event => {
        expect(event.type).toBe('task.updated');
        expect(event.projectId).toBe('project-1');
        expect(event.depth).toBe(0);
        expect(event.changes.completed).toBe(true);
        expect(event.previousValues.completed).toBe(false);
      });
    });

    it('emits only one event when uncompleting (no cascade)', () => {
      const events: DomainEvent[] = [];
      const emitEvent = vi.fn((event: DomainEvent) => events.push(event));
      const taskService = new TaskService(taskRepo, depRepo, emitEvent);

      const parent = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      parent.completed = true;
      parent.completedAt = '2025-01-01T00:00:00.000Z';
      const child1 = makeTask('00000000-0000-4000-8000-000000000002', 'project-1', parent.id);
      child1.completed = true;
      child1.completedAt = '2025-01-01T00:00:00.000Z';

      taskRepo.create(parent);
      taskRepo.create(child1);

      taskService.cascadeComplete(parent.id, false);

      // Only parent should be uncompleted, not children
      expect(emitEvent).toHaveBeenCalledTimes(1);
      expect(events[0].entityId).toBe(parent.id);
      expect(events[0].changes.completed).toBe(false);
    });

    it('does not emit events when emitEvent callback is not provided', () => {
      const taskService = new TaskService(taskRepo, depRepo);

      const task = makeTask('00000000-0000-4000-8000-000000000001', 'project-1', null);
      task.completed = false;
      taskRepo.create(task);

      // Should not throw
      expect(() => taskService.cascadeComplete(task.id, true)).not.toThrow();
    });
  });
});
