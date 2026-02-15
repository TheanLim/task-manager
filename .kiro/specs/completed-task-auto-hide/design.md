# Design Document: Completed Task Auto-Hide

## Overview

This feature adds a time-based auto-hide filter to the All Tasks page. Completed tasks are hidden after a configurable threshold (default 24h) measured from their `completedAt` timestamp. The filter is read-time only — no data is modified. It layers on top of existing Review Queue and Hide Completed modes, and respects Nested/Flat display semantics.

The core logic lives in a pure filter function in the service layer, following the project's architecture rules (no business logic in stores, no direct store imports in domain logic).

## Architecture

```mermaid
graph TD
    subgraph "App Settings (Zustand)"
        A[autoHideThreshold: '24h' | '48h' | '1w' | 'never']
        B[showRecentlyCompleted: boolean]
    end

    subgraph "Service Layer (Pure Functions)"
        C[filterAutoHiddenTasks]
    end

    subgraph "Components"
        D[GlobalTasksView] -->|passes tasks + options| C
        E[GlobalTasksHeader] -->|threshold dropdown| A
        E -->|recently completed toggle| B
    end

    C -->|filtered tasks| D
    A -->|threshold value| D
    B -->|show/hide flag| D
```

### Key Design Decisions

1. **Pure filter function**: `filterAutoHiddenTasks(tasks, options)` lives in `features/tasks/services/autoHideService.ts`. It accepts a flat array of tasks and filter options, returns the filtered array. No store dependencies.

2. **Threshold stored in appStore**: A new `autoHideThreshold` field in the persisted app store. This follows the existing pattern for `hideCompletedTasks` and `globalTasksDisplayMode`.

3. **Recently Completed as a toggle**: A `showRecentlyCompleted` boolean in appStore. When active, the filter inverts — showing only auto-hidden tasks. This is simpler than a separate tab and consistent with the existing toggle pattern (Hide Completed, Review Queue).

4. **Nested vs Flat handled by the filter function**: The filter accepts a `displayMode` option and applies parent-aware logic for nested mode vs independent evaluation for flat mode.

5. **Current time injection**: The filter function accepts a `now` parameter (defaults to `Date.now()`) for testability. No `new Date()` calls inside the filter.

## Components and Interfaces

### `filterAutoHiddenTasks` (Service Function)

```typescript
// features/tasks/services/autoHideService.ts

export type AutoHideThreshold = '24h' | '48h' | '1w' | 'never';

export interface AutoHideFilterOptions {
  threshold: AutoHideThreshold;
  displayMode: 'nested' | 'flat';
  now?: number; // ms since epoch, defaults to Date.now()
}

/**
 * Returns the threshold duration in milliseconds.
 * Returns null for 'never' (no auto-hide).
 */
export function getThresholdMs(threshold: AutoHideThreshold): number | null;

/**
 * Determines whether a single task should be auto-hidden based on its
 * completedAt timestamp and the configured threshold.
 * Returns true if the task should be hidden.
 */
export function isTaskAutoHidden(
  task: Task,
  thresholdMs: number,
  now: number
): boolean;

/**
 * Filters tasks for the All Tasks page, applying auto-hide logic.
 *
 * Nested mode:
 * - Completed parent past threshold → hidden, all its subtasks hidden too
 * - Active parent → completed subtasks stay visible (context)
 *
 * Flat mode:
 * - Each task evaluated independently against threshold
 * - Completed subtask with active parent stays visible regardless of age
 *
 * Returns the filtered task array (does not mutate input).
 */
export function filterAutoHiddenTasks(
  tasks: Task[],
  allTasks: Task[], // full task list for parent lookups
  options: AutoHideFilterOptions
): Task[];
```

### AppStore Changes

```typescript
// New fields in AppStore interface
autoHideThreshold: AutoHideThreshold;       // default: '24h'
showRecentlyCompleted: boolean;              // default: false

// New actions
setAutoHideThreshold: (threshold: AutoHideThreshold) => void;
setShowRecentlyCompleted: (show: boolean) => void;
```

### Zod Schema Addition

```typescript
// lib/schemas.ts
export const AutoHideThresholdSchema = z.enum(['24h', '48h', '1w', 'never']);
```

### GlobalTasksHeader Changes

Add a threshold dropdown (small settings control) and a "Recently completed" toggle button to the header bar, next to the existing Hide Completed and Nested/Flat toggles.

```typescript
// New UI elements in GlobalTasksHeader:
// 1. Threshold dropdown — only visible when not in Review Queue mode
// 2. "Recently completed" toggle — only visible when threshold !== 'never'
//    and not in Review Queue mode
```

### GlobalTasksView Changes

Replace the current inline completed-task filter with a call to `filterAutoHiddenTasks`:

```typescript
// Current:
const filteredTasks = useMemo(() => {
  if (!shouldHideCompleted) return displayTasks;
  return displayTasks.filter(t => !t.completed);
}, [displayTasks, shouldHideCompleted]);

// New:
const filteredTasks = useMemo(() => {
  if (needsAttentionSort || hideCompletedTasks) {
    // Review Queue or Hide Completed: hide ALL completed (existing behavior)
    return displayTasks.filter(t => !t.completed);
  }
  if (autoHideThreshold === 'never' && !showRecentlyCompleted) {
    return displayTasks;
  }
  if (showRecentlyCompleted) {
    // Show ONLY the auto-hidden tasks (inverted filter)
    return filterAutoHiddenTasks(displayTasks, tasks, {
      threshold: autoHideThreshold,
      displayMode: globalTasksDisplayMode,
    }).autoHidden;
  }
  // Normal mode: apply auto-hide
  return filterAutoHiddenTasks(displayTasks, tasks, {
    threshold: autoHideThreshold,
    displayMode: globalTasksDisplayMode,
  }).visible;
}, [displayTasks, tasks, needsAttentionSort, hideCompletedTasks,
    autoHideThreshold, showRecentlyCompleted, globalTasksDisplayMode]);
```

> **Refinement**: The filter function returns `{ visible, autoHidden }` so the component can use either set without filtering twice.

### Updated Filter Function Signature

```typescript
export interface AutoHideFilterResult {
  visible: Task[];
  autoHidden: Task[];
}

export function filterAutoHiddenTasks(
  tasks: Task[],
  allTasks: Task[],
  options: AutoHideFilterOptions
): AutoHideFilterResult;
```

## Data Models

### Existing Task Schema (unchanged)

The `Task` type already has the fields needed:
- `completed: boolean`
- `completedAt: string | null` (ISO datetime)
- `parentTaskId: string | null`

No schema changes to the Task model.

### New: AutoHideThreshold Type

```typescript
// Zod schema
export const AutoHideThresholdSchema = z.enum(['24h', '48h', '1w', 'never']);
export type AutoHideThreshold = z.infer<typeof AutoHideThresholdSchema>;
```

### AppSettings Extension

```typescript
// Add to AppSettingsSchema:
autoHideThreshold: AutoHideThresholdSchema.optional().default('24h'),
```

The `optional().default()` pattern ensures backward compatibility — existing persisted settings without this field will default to `'24h'`.

### Threshold Duration Mapping

| Threshold | Milliseconds |
|-----------|-------------|
| `'24h'`   | 86,400,000  |
| `'48h'`   | 172,800,000 |
| `'1w'`    | 604,800,000 |
| `'never'` | `null`      |



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Threshold boundary for parent tasks

*For any* parent task (no `parentTaskId`) that is completed, and *for any* threshold value, the task should appear in `visible` if `now - completedAt < thresholdMs` and in `autoHidden` if `now - completedAt >= thresholdMs`.

**Validates: Requirements 1.1, 1.2**

### Property 2: Nested mode subtask visibility follows parent

*For any* set of tasks in nested mode, a completed subtask should be visible when its parent is not completed (regardless of the subtask's own completion age), and a subtask should be auto-hidden when its parent task is auto-hidden (past the threshold).

**Validates: Requirements 2.1, 2.2, 6.1, 6.2**

### Property 3: Flat mode independent evaluation with active-parent exception

*For any* set of tasks in flat mode, each task is evaluated independently against the threshold, except that a completed subtask with a non-completed parent is always visible regardless of its own completion age.

**Validates: Requirements 2.3, 6.3, 6.4**

### Property 4: 'Never' threshold returns all tasks unchanged

*For any* set of tasks, calling `filterAutoHiddenTasks` with threshold `'never'` should return all input tasks in `visible` and an empty `autoHidden` array.

**Validates: Requirements 3.3**

### Property 5: Override modes hide all completed tasks

*For any* set of tasks and *for any* threshold value, when either Review Queue mode or Hide Completed toggle is active, all completed tasks should be excluded from the visible result. (This is tested at the component integration level since the override logic lives in `GlobalTasksView`, not in the filter function.)

**Validates: Requirements 4.1, 5.1**

### Property 6: Progress count invariant

*For any* parent task with subtasks, the progress count (completed/total) should equal the count computed from all subtasks in the unfiltered data store, regardless of which subtasks are excluded by the Auto_Hide_Filter.

**Validates: Requirements 7.1, 7.2**

### Property 7: Filter does not mutate input

*For any* input task array and *for any* filter options, calling `filterAutoHiddenTasks` should not modify the original input arrays.

**Validates: Requirements 8.2**

### Property 8: Visible and autoHidden partition the input

*For any* input task array and *for any* filter options, the union of `visible` and `autoHidden` should equal the original input set (no tasks lost or duplicated), and their intersection should be empty.

**Validates: Requirements 9.2**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Task has `completed: true` but `completedAt: null` | Treat as not auto-hideable (keep visible). The filter should not crash on missing timestamps. |
| Invalid threshold value | Zod schema validation rejects it at the store boundary. Filter function receives only valid values. |
| `allTasks` missing a parent referenced by `parentTaskId` | Treat the subtask as having no parent (evaluate independently). Defensive lookup. |
| Clock skew (completedAt in the future) | Task appears as "recently completed" (negative elapsed time < threshold). No special handling needed. |

## Testing Strategy

### Property-Based Tests (fast-check)

Each correctness property maps to a single property-based test in `features/tasks/services/autoHideService.test.ts`. Tests use fast-check to generate random task sets with varying completion states, timestamps, parent-child relationships, and threshold values.

**Configuration**: Minimum 100 iterations per property test.

**Tag format**: `Feature: completed-task-auto-hide, Property N: <title>`

**Generator strategy**:
- Generate random task arrays with a mix of parent tasks and subtasks
- Randomize `completed`, `completedAt` (relative to a fixed `now`), and `parentTaskId`
- Randomize threshold selection from the four valid options
- Randomize display mode ('nested' | 'flat')

### Unit Tests

Unit tests complement property tests for specific examples and edge cases:

- `completedAt: null` with `completed: true` → task stays visible
- Exact threshold boundary (completedAt exactly at threshold) → task is hidden
- Empty task array → returns empty visible and autoHidden
- `getThresholdMs` returns correct millisecond values for each option
- `isTaskAutoHidden` returns correct boolean for known inputs

### Integration Tests

- GlobalTasksView renders correctly with auto-hide active (React Testing Library)
- Threshold dropdown in GlobalTasksHeader updates appStore
- Recently Completed toggle shows/hides the correct tasks
- Review Queue mode overrides auto-hide behavior

### Test Libraries

- **Property-based**: fast-check (already in project dependencies)
- **Unit/Integration**: Vitest + React Testing Library (existing setup)
- **E2E**: Playwright (existing setup) — mention that `npm run test:e2e` should be run manually after implementation
