import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TMSStateSchema } from '@/lib/schemas';
import { Task, TMSState, TimeManagementSystem } from '@/types';
import { getTMSHandler, TimeManagementSystemHandler } from './index';

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

const taskArrayArb = fc.array(taskArb, { minLength: 0, maxLength: 10 });

/**
 * Generate a TMSState where dit/af4/fvp sub-state task IDs reference
 * actual task IDs from the provided tasks array, making the state realistic.
 */
function tmsStateArbForTasks(tasks: Task[]): fc.Arbitrary<TMSState> {
  const taskIds = tasks.map((t) => t.id);
  const subsetArb =
    taskIds.length > 0
      ? fc.subarray(taskIds, { minLength: 0 })
      : fc.constant([] as string[]);

  return fc.record({
    activeSystem: fc.constantFrom(
      'none' as const,
      'dit' as const,
      'af4' as const,
      'fvp' as const
    ),
    dit: subsetArb.chain((todayTasks) => {
      const remaining = taskIds.filter((id) => !todayTasks.includes(id));
      const tomorrowArb =
        remaining.length > 0
          ? fc.subarray(remaining, { minLength: 0 })
          : fc.constant([] as string[]);
      return tomorrowArb.map((tomorrowTasks) => ({
        todayTasks,
        tomorrowTasks,
        lastDayChange: new Date().toISOString(),
      }));
    }),
    af4: subsetArb.map((marked) => ({
      markedTasks: marked,
      markedOrder: [...marked], // markedOrder is same set, possibly shuffled
    })),
    fvp: fc.record({
      dottedTasks: subsetArb,
      currentX: fc.option(
        taskIds.length > 0
          ? fc.constantFrom(...taskIds)
          : fc.constant('none'),
        { nil: null }
      ),
      selectionInProgress: fc.boolean(),
    }),
  });
}

/** All TMS system types to test */
const allSystems: TimeManagementSystem[] = [
  TimeManagementSystem.NONE,
  TimeManagementSystem.DIT,
  TimeManagementSystem.AF4,
  TimeManagementSystem.FVP,
];

/**
 * Deep-merge a partial TMSState delta into an existing TMSState.
 * Handles nested objects (dit, af4, fvp) correctly.
 */
function mergeTMSState(base: TMSState, delta: Partial<TMSState>): TMSState {
  return {
    activeSystem: delta.activeSystem ?? base.activeSystem,
    dit: delta.dit ? { ...base.dit, ...delta.dit } : base.dit,
    af4: delta.af4 ? { ...base.af4, ...delta.af4 } : base.af4,
    fvp: delta.fvp ? { ...base.fvp, ...delta.fvp } : base.fvp,
  };
}

describe('Feature: architecture-refactor', () => {
  describe('Property 9: TMS getOrderedTasks returns a permutation', () => {
    for (const system of allSystems) {
      it(`Feature: architecture-refactor, Property 9: TMS getOrderedTasks returns a permutation [${system}]`, () => {
        /**
         * **Validates: Requirements 6.1**
         *
         * For any array of tasks and valid TMS state, calling a TMS handler's
         * getOrderedTasks SHALL return an array that is a permutation of the input
         * (same elements, same length, possibly different order).
         *
         * Note: Some handlers (AF4, FVP) may filter out referenced tasks not in
         * the input list. The property checks that:
         * 1. Result length equals input length
         * 2. Every result element comes from the input
         * 3. Every input element appears in the result
         */
        const handler = getTMSHandler(system);

        fc.assert(
          fc.property(
            taskArrayArb.chain((tasks) =>
              tmsStateArbForTasks(tasks).map((tmsState) => ({ tasks, tmsState }))
            ),
            ({ tasks, tmsState }) => {
              const result = handler.getOrderedTasks(tasks, tmsState);

              // Same length
              expect(result).toHaveLength(tasks.length);

              // Every result element is from the input
              const inputIds = new Set(tasks.map((t) => t.id));
              for (const t of result) {
                expect(inputIds.has(t.id)).toBe(true);
              }

              // Every input element appears in the result
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
         * For any task and valid TMS state, calling onTaskCompleted or onTaskCreated
         * SHALL return a partial TMS state object that, when merged with the original
         * state, produces a valid TMSState according to the Zod schema.
         */
        const handler = getTMSHandler(system);

        fc.assert(
          fc.property(
            taskArb.chain((task) =>
              tmsStateArbForTasks([task]).map((tmsState) => ({ task, tmsState }))
            ),
            ({ task, tmsState }) => {
              // Test onTaskCompleted
              const completedDelta = handler.onTaskCompleted(task, tmsState);
              const mergedAfterComplete = mergeTMSState(tmsState, completedDelta);
              const completeResult = TMSStateSchema.safeParse(mergedAfterComplete);
              expect(completeResult.success).toBe(true);

              // Test onTaskCreated
              const createdDelta = handler.onTaskCreated(task, tmsState);
              const mergedAfterCreate = mergeTMSState(tmsState, createdDelta);
              const createResult = TMSStateSchema.safeParse(mergedAfterCreate);
              expect(createResult.success).toBe(true);
            }
          ),
          PROPERTY_CONFIG
        );
      });
    }
  });

  describe('Property 11: TMS initialize returns valid state', () => {
    for (const system of allSystems) {
      it(`Feature: architecture-refactor, Property 11: TMS initialize returns valid state [${system}]`, () => {
        /**
         * **Validates: Requirements 6.4**
         *
         * For any array of tasks and valid TMS state, calling initialize SHALL
         * return a partial TMS state object that, when merged with the original
         * state, produces a valid TMSState according to the Zod schema.
         */
        const handler = getTMSHandler(system);

        fc.assert(
          fc.property(
            taskArrayArb.chain((tasks) =>
              tmsStateArbForTasks(tasks).map((tmsState) => ({ tasks, tmsState }))
            ),
            ({ tasks, tmsState }) => {
              const delta = handler.initialize(tasks, tmsState);
              const merged = mergeTMSState(tmsState, delta);
              const result = TMSStateSchema.safeParse(merged);
              expect(result.success).toBe(true);
            }
          ),
          PROPERTY_CONFIG
        );
      });
    }
  });
});
