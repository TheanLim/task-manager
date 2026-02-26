import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TMSStateSchema } from '@/lib/schemas';
import { Task, TMSState, TimeManagementSystem } from '@/types';
import { getTMSHandler } from '../registry';
import type { TimeManagementSystemHandler } from './index';
import type { DITState } from './DITHandler';
import type { AF4State } from './af4';
import type { FVPState } from './fvp';

// Minimum 100 iterations per property
const PROPERTY_CONFIG = { numRuns: 100 };

// --- Arbitraries ---

const taskArb: fc.Arbitrary<Task> = fc.record({
  id: fc.uuid(),
  projectId: fc.option(fc.uuid(), { nil: null }),
  parentTaskId: fc.option(fc.uuid(), { nil: null }),
  sectionId: fc.option(fc.string(), { nil: null }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  notes: fc.string({ maxLength: 50 }),
  assignee: fc.string({ maxLength: 20 }),
  priority: fc.constantFrom('none' as const, 'low' as const, 'medium' as const, 'high' as const),
  tags: fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
  dueDate: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  completed: fc.boolean(),
  completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  order: fc.integer({ min: 0, max: 1000 }),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

// Task arrays with guaranteed unique IDs
const taskArrayArb = fc.uniqueArray(taskArb, { selector: (t) => t.id, minLength: 0, maxLength: 10 });

/** Generate a DITState with task IDs from the provided tasks */
function ditStateArbForTasks(tasks: Task[]): fc.Arbitrary<DITState> {
  const taskIds = tasks.map((t) => t.id);
  const subsetArb = taskIds.length > 0 ? fc.subarray(taskIds) : fc.constant([] as string[]);
  return subsetArb.chain((todayTasks) => {
    const remaining = taskIds.filter((id) => !todayTasks.includes(id));
    const tomorrowArb = remaining.length > 0 ? fc.subarray(remaining) : fc.constant([] as string[]);
    return tomorrowArb.map((tomorrowTasks) => ({
      todayTasks,
      tomorrowTasks,
      lastDayChange: new Date().toISOString(),
    }));
  });
}

/** Generate an AF4State with task IDs from the provided tasks */
function af4StateArbForTasks(tasks: Task[]): fc.Arbitrary<AF4State> {
  const taskIds = tasks.map((t) => t.id);
  const subsetArb = taskIds.length > 0 ? fc.subarray(taskIds) : fc.constant([] as string[]);
  return subsetArb.chain((backlog) => {
    const remaining = taskIds.filter((id) => !backlog.includes(id));
    const activeArb = remaining.length > 0 ? fc.subarray(remaining) : fc.constant([] as string[]);
    return activeArb.chain((active) =>
      fc.record({
        backlogTaskIds: fc.constant(backlog),
        activeListTaskIds: fc.constant(active),
        currentPosition: fc.integer({ min: 0, max: Math.max(0, backlog.length) }),
        lastPassHadWork: fc.boolean(),
        dismissedTaskIds: backlog.length > 0 ? fc.subarray(backlog) : fc.constant([] as string[]),
        phase: fc.constantFrom('backlog' as const, 'active' as const),
      })
    );
  });
}

/** Generate an FVPState with task IDs from the provided tasks */
function fvpStateArbForTasks(tasks: Task[]): fc.Arbitrary<FVPState> {
  const taskIds = tasks.map((t) => t.id);
  const subsetArb = taskIds.length > 0 ? fc.subarray(taskIds) : fc.constant([] as string[]);
  return subsetArb.chain((dottedTasks) =>
    fc.record({
      dottedTasks: fc.constant(dottedTasks),
      scanPosition: fc.integer({ min: 0, max: Math.max(1, taskIds.length) }),
    })
  );
}

/** Generate a system-specific state for the given system */
function systemStateArbForTasks(system: TimeManagementSystem, tasks: Task[]): fc.Arbitrary<unknown> {
  switch (system) {
    case TimeManagementSystem.DIT: return ditStateArbForTasks(tasks);
    case TimeManagementSystem.AF4: return af4StateArbForTasks(tasks);
    case TimeManagementSystem.FVP: return fvpStateArbForTasks(tasks);
    default: return fc.constant({});
  }
}

/** Build a valid TMSState (new open shape) for schema validation */
function makeTMSState(system: TimeManagementSystem, systemState: unknown): TMSState {
  return {
    activeSystem: system,
    systemStates: system !== TimeManagementSystem.NONE ? { [system]: systemState } : {},
    systemStateVersions: {},
  };
}

/** All TMS system types to test */
const allSystems: TimeManagementSystem[] = [
  TimeManagementSystem.NONE,
  TimeManagementSystem.DIT,
  TimeManagementSystem.AF4,
  TimeManagementSystem.FVP,
];

describe('Feature: architecture-refactor', () => {
  describe('Property 9: TMS getOrderedTasks returns a permutation', () => {
    for (const system of allSystems) {
      it(`Feature: architecture-refactor, Property 9: TMS getOrderedTasks returns a permutation [${system}]`, () => {
        /**
         * **Validates: Requirements 6.1**
         *
         * For any array of tasks and valid system state, calling a TMS handler's
         * getOrderedTasks SHALL return an array that is a permutation of the input.
         */
        const handler = getTMSHandler(system);

        fc.assert(
          fc.property(
            taskArrayArb.chain((tasks) =>
              systemStateArbForTasks(system, tasks).map((systemState) => ({ tasks, systemState }))
            ),
            ({ tasks, systemState }) => {
              const result = handler.getOrderedTasks(tasks, systemState);

              expect(result).toHaveLength(tasks.length);

              const inputIds = new Set(tasks.map((t) => t.id));
              for (const t of result) {
                expect(inputIds.has(t.id)).toBe(true);
              }

              const resultIds = new Set(result.map((t) => t.id));
              for (const t of tasks) {
                expect(resultIds.has(t.id)).toBe(true);
              }
            }
          ),
          PROPERTY_CONFIG
        );
      });
    }
  });

  describe('Property 10: TMS task lifecycle handlers return valid state', () => {
    for (const system of allSystems) {
      it(`Feature: architecture-refactor, Property 10: TMS task lifecycle handlers return valid state [${system}]`, () => {
        /**
         * **Validates: Requirements 6.2, 6.3**
         *
         * For any task and valid system state, calling onTaskCompleted or onTaskCreated
         * SHALL return a partial state that, when merged into a TMSState, passes schema validation.
         */
        const handler = getTMSHandler(system);

        fc.assert(
          fc.property(
            taskArb.chain((task) =>
              systemStateArbForTasks(system, [task]).map((systemState) => ({ task, systemState }))
            ),
            ({ task, systemState }) => {
              // Test onTaskCompleted
              const completedDelta = handler.onTaskCompleted(task, systemState);
              const mergedCompleted = { ...systemState as object, ...completedDelta as object };
              const tmsAfterComplete = makeTMSState(system, mergedCompleted);
              const completeResult = TMSStateSchema.safeParse(tmsAfterComplete);
              expect(completeResult.success).toBe(true);

              // Test onTaskCreated
              const createdDelta = handler.onTaskCreated(task, systemState);
              const mergedCreated = { ...systemState as object, ...createdDelta as object };
              const tmsAfterCreate = makeTMSState(system, mergedCreated);
              const createResult = TMSStateSchema.safeParse(tmsAfterCreate);
              expect(createResult.success).toBe(true);
            }
          ),
          PROPERTY_CONFIG
        );
      });
    }
  });

  describe('Property 11: TMS onActivate returns valid state', () => {
    for (const system of allSystems) {
      it(`Feature: architecture-refactor, Property 11: TMS initialize returns valid state [${system}]`, () => {
        /**
         * **Validates: Requirements 6.4**
         *
         * For any array of tasks and valid system state, calling onActivate SHALL
         * return a partial state that, when merged into a TMSState, passes schema validation.
         */
        const handler = getTMSHandler(system);

        fc.assert(
          fc.property(
            taskArrayArb.chain((tasks) =>
              systemStateArbForTasks(system, tasks).map((systemState) => ({ tasks, systemState }))
            ),
            ({ tasks, systemState }) => {
              const delta = handler.onActivate(tasks, systemState);
              const merged = { ...systemState as object, ...delta as object };
              const tmsState = makeTMSState(system, merged);
              const result = TMSStateSchema.safeParse(tmsState);
              expect(result.success).toBe(true);
            }
          ),
          PROPERTY_CONFIG
        );
      });
    }
  });
});
