import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { LocalStorageAdapter, ImportError } from './storage';
import { AppStateSchema, TaskSchema } from './schemas';

// Minimum 100 iterations per property
const PROPERTY_CONFIG = { numRuns: 100 };

/**
 * Arbitrary that generates a valid AppState object.
 * Used as a base for creating invalid variants.
 */
const validAppStateArb = fc.record({
  projects: fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 200 }),
      description: fc.string(),
      viewMode: fc.constantFrom('list', 'board', 'calendar'),
      createdAt: fc.date().map((d) => d.toISOString()),
      updatedAt: fc.date().map((d) => d.toISOString()),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  tasks: fc.array(
    fc.record({
      id: fc.uuid(),
      projectId: fc.option(fc.uuid(), { nil: null }),
      parentTaskId: fc.option(fc.uuid(), { nil: null }),
      sectionId: fc.option(fc.string(), { nil: null }),
      description: fc.string({ minLength: 1, maxLength: 500 }),
      notes: fc.string(),
      assignee: fc.string(),
      priority: fc.constantFrom('none', 'low', 'medium', 'high'),
      tags: fc.array(fc.string(), { maxLength: 5 }),
      dueDate: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
      completed: fc.boolean(),
      completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
      order: fc.integer(),
      createdAt: fc.date().map((d) => d.toISOString()),
      updatedAt: fc.date().map((d) => d.toISOString()),
      lastActionAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  sections: fc.array(
    fc.record({
      id: fc.string({ minLength: 1 }),
      projectId: fc.option(fc.string(), { nil: null }),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      order: fc.integer(),
      collapsed: fc.boolean(),
      createdAt: fc.date().map((d) => d.toISOString()),
      updatedAt: fc.date().map((d) => d.toISOString()),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  dependencies: fc.array(
    fc.record({
      id: fc.uuid(),
      blockingTaskId: fc.uuid(),
      blockedTaskId: fc.uuid(),
      createdAt: fc.date().map((d) => d.toISOString()),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  tmsState: fc.record({
    activeSystem: fc.constantFrom('none', 'dit', 'af4', 'fvp'),
    dit: fc.record({
      todayTasks: fc.array(fc.string(), { maxLength: 3 }),
      tomorrowTasks: fc.array(fc.string(), { maxLength: 3 }),
      lastDayChange: fc.date().map((d) => d.toISOString()),
    }),
    af4: fc.record({
      markedTasks: fc.array(fc.string(), { maxLength: 3 }),
      markedOrder: fc.array(fc.string(), { maxLength: 3 }),
    }),
    fvp: fc.record({
      dottedTasks: fc.array(fc.string(), { maxLength: 3 }),
      currentX: fc.option(fc.string(), { nil: null }),
      selectionInProgress: fc.boolean(),
    }),
  }),
  settings: fc.record({
    activeProjectId: fc.option(fc.uuid(), { nil: null }),
    timeManagementSystem: fc.constantFrom('none', 'dit', 'af4', 'fvp'),
    showOnlyActionableTasks: fc.boolean(),
    theme: fc.constantFrom('light', 'dark', 'system'),
    autoHideThreshold: fc.option(fc.constantFrom('24h', '48h', '1w', 'never'), { nil: undefined }),
  }),
  version: fc.string({ minLength: 1 }),
});

/**
 * Strategies for corrupting a valid AppState to make it invalid.
 * Each strategy targets a different structural violation that Zod should reject.
 */
type CorruptionStrategy = (state: Record<string, unknown>) => Record<string, unknown>;

const corruptionStrategies: fc.Arbitrary<CorruptionStrategy> = fc.constantFrom<CorruptionStrategy>(
  // Replace projects with a non-array
  (state) => ({ ...state, projects: 'not-an-array' }),
  // Replace tasks with a non-array
  (state) => ({ ...state, tasks: 42 }),
  // Replace sections with a boolean
  (state) => ({ ...state, sections: true }),
  // Replace dependencies with null
  (state) => ({ ...state, dependencies: null }),
  // Remove required top-level field
  (state) => {
    const { projects, ...rest } = state;
    return rest;
  },
  (state) => {
    const { tasks, ...rest } = state;
    return rest;
  },
  (state) => {
    const { tmsState, ...rest } = state;
    return rest;
  },
  (state) => {
    const { settings, ...rest } = state;
    return rest;
  },
  (state) => {
    const { version, ...rest } = state;
    return rest;
  },
  // Replace tmsState with invalid structure
  (state) => ({ ...state, tmsState: { invalid: true } }),
  // Replace settings with invalid structure
  (state) => ({ ...state, settings: 'bad-settings' }),
  // Replace version with a number instead of string
  (state) => ({ ...state, version: 123 }),
  // Inject invalid project into projects array
  (state) => ({ ...state, projects: [{ id: 'not-a-uuid', name: '' }] }),
  // Inject invalid task (missing required fields)
  (state) => ({ ...state, tasks: [{ id: 'not-a-uuid' }] }),
  // Replace tmsState.activeSystem with invalid enum value
  (state) => ({
    ...state,
    tmsState: { ...(state.tmsState as Record<string, unknown>), activeSystem: 'invalid-system' },
  }),
  // Replace settings.theme with invalid enum value
  (state) => ({
    ...state,
    settings: { ...(state.settings as Record<string, unknown>), theme: 'neon' },
  }),
);

/**
 * Arbitrary that generates objects guaranteed to fail AppStateSchema validation.
 * Takes a valid AppState and applies a random corruption strategy.
 */
const invalidAppStateArb = fc.tuple(validAppStateArb, corruptionStrategies).map(([valid, corrupt]) =>
  corrupt(valid as unknown as Record<string, unknown>)
);

/**
 * Arbitrary that generates JSON strings guaranteed to fail AppStateSchema validation.
 * Includes both structurally invalid objects and syntactically invalid JSON.
 */
const invalidJsonForImportArb = fc.oneof(
  // Corrupted valid state serialized as JSON
  invalidAppStateArb.map((obj) => JSON.stringify(obj)),
  // Completely random objects that aren't AppState-shaped
  fc.oneof(
    fc.constant('{}'),
    fc.constant('[]'),
    fc.constant('null'),
    fc.constant(JSON.stringify({ random: 'object' })),
    fc.string().filter((s) => {
      // Only keep strings that are NOT valid JSON or are valid JSON but not valid AppState
      try {
        const parsed = JSON.parse(s);
        return !AppStateSchema.safeParse(parsed).success;
      } catch {
        // Syntactically invalid JSON — good for testing
        return true;
      }
    }),
  ),
);

describe('Feature: architecture-refactor', () => {
  let adapter: LocalStorageAdapter;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    mockLocalStorage = {};

    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    } as Storage;
  });

  describe('Property 1: Zod validation rejects invalid data on load', () => {
    it('Feature: architecture-refactor, Property 1: Zod validation rejects invalid data on load', () => {
      /**
       * **Validates: Requirements 1.3**
       *
       * For any object that does not conform to the AppState Zod schema,
       * calling the storage adapter's load method with that object in
       * localStorage SHALL return null.
       */
      fc.assert(
        fc.property(invalidAppStateArb, (invalidState) => {
          // Precondition: confirm the object actually fails Zod validation
          const parseResult = AppStateSchema.safeParse(invalidState);
          fc.pre(!parseResult.success);

          // Place the invalid object in localStorage under the unified key
          mockLocalStorage['task-management-app-state'] = JSON.stringify(invalidState);

          // Suppress console.error from validation logging
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

          try {
            const result = adapter.load();
            expect(result).toBeNull();
          } finally {
            consoleSpy.mockRestore();
            consoleLogSpy.mockRestore();
          }
        }),
        PROPERTY_CONFIG
      );
    });
  });

  describe('Property 2: Zod validation rejects invalid data on import', () => {
    it('Feature: architecture-refactor, Property 2: Zod validation rejects invalid data on import', () => {
      /**
       * **Validates: Requirements 1.4**
       *
       * For any JSON string that does not represent a valid AppState
       * according to the Zod schema, calling importFromJSON SHALL
       * throw an ImportError.
       */
      fc.assert(
        fc.property(invalidJsonForImportArb, (invalidJson) => {
          // Precondition: verify the JSON doesn't accidentally produce a valid AppState
          try {
            const parsed = JSON.parse(invalidJson);
            const parseResult = AppStateSchema.safeParse(parsed);
            fc.pre(!parseResult.success);
          } catch {
            // Syntactically invalid JSON is fine — importFromJSON should still throw ImportError
          }

          expect(() => adapter.importFromJSON(invalidJson)).toThrow(ImportError);
        }),
        PROPERTY_CONFIG
      );
    });
  });
});

describe('Feature: task-last-action-ordering, Property 1: Schema validation with backward compatibility', () => {
  it('Feature: task-last-action-ordering, Property 1: Schema validation with backward compatibility', () => {
    /**
     * **Validates: Requirements 1.1, 7.1**
     *
     * For any valid task object, the Zod TaskSchema should accept it whether
     * lastActionAt is a valid datetime string, null, or entirely absent.
     * For any task object where lastActionAt is a non-datetime string,
     * the schema should reject it.
     */
    // Constrain dates to 4-digit years so toISOString() produces Zod-compatible datetime
    const safeDate = fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') });

    const baseTaskArb = fc.record({
      id: fc.uuid(),
      projectId: fc.option(fc.uuid(), { nil: null }),
      parentTaskId: fc.option(fc.uuid(), { nil: null }),
      sectionId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
      description: fc.string({ minLength: 1, maxLength: 500 }),
      notes: fc.string(),
      assignee: fc.string(),
      priority: fc.constantFrom('none' as const, 'low' as const, 'medium' as const, 'high' as const),
      tags: fc.array(fc.string(), { maxLength: 5 }),
      dueDate: fc.option(safeDate.map((d) => d.toISOString()), { nil: null }),
      completed: fc.boolean(),
      completedAt: fc.option(safeDate.map((d) => d.toISOString()), { nil: null }),
      order: fc.integer(),
      createdAt: safeDate.map((d) => d.toISOString()),
      updatedAt: safeDate.map((d) => d.toISOString()),
    });

    // Valid lastActionAt variants: datetime string, null, or absent
    const lastActionAtVariantArb = fc.oneof(
      fc.constant({ lastActionAt: null } as { lastActionAt?: string | null }),
      safeDate.map((d) => ({ lastActionAt: d.toISOString() }) as { lastActionAt?: string | null }),
      fc.constant({} as { lastActionAt?: string | null }),
    );

    fc.assert(
      fc.property(baseTaskArb, lastActionAtVariantArb, (baseTask, variant) => {
        const task = { ...baseTask, ...variant };
        const result = TaskSchema.safeParse(task);
        expect(result.success).toBe(true);
      }),
      PROPERTY_CONFIG,
    );

    // Invalid: non-datetime strings should be rejected
    const invalidLastActionAtArb = fc.string({ minLength: 1 }).filter(
      (s) => Number.isNaN(Date.parse(s)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s),
    );

    fc.assert(
      fc.property(baseTaskArb, invalidLastActionAtArb, (baseTask, badValue) => {
        const task = { ...baseTask, lastActionAt: badValue };
        const result = TaskSchema.safeParse(task);
        expect(result.success).toBe(false);
      }),
      PROPERTY_CONFIG,
    );
  });
});

