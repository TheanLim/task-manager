<!-- v1 | last-verified: 2025-07-15 -->
# Time Management Systems (TMS)

Pluggable task-ordering strategies that change how tasks are prioritized and displayed. Four strategies share a common pure-function handler interface. Strategy metadata lives in its own Zustand store (`tmsStore`), while the active strategy selection lives in `appStore.settings.timeManagementSystem`. The system is designed so all strategy metadata coexists — switching strategies clears metadata via `clearSystemMetadata()` with a confirmation dialog.

## Strategy Overview

| System | Enum | Core Idea | Ordering | On Task Created | On Task Completed |
|--------|------|-----------|----------|-----------------|-------------------|
| Standard | `NONE` | Default sort | `task.order` ascending | No-op | No-op |
| Do It Tomorrow | `DIT` | Today/Tomorrow scheduling with day rollover | Today → Tomorrow → Unscheduled | Add to Tomorrow list | Remove from both lists |
| Autofocus 4 | `AF4` | Mark tasks to focus on | Marked (in mark-order) → Unmarked | No-op | Remove mark |
| Final Version Perfected | `FVP` | Pairwise comparison scan | Dotted (reversed) → Undotted | No-op | Remove dot, reset X if needed |

## Handler Interface

All handlers are pure functions — no store access. Call sites read state, pass it in, and apply returned deltas.

```typescript
interface TimeManagementSystemHandler {
  name: TimeManagementSystem;
  initialize(tasks: Task[], tmsState: TMSState): Partial<TMSState>;
  getOrderedTasks(tasks: Task[], tmsState: TMSState): Task[];
  onTaskCreated(task: Task, tmsState: TMSState): Partial<TMSState>;
  onTaskCompleted(task: Task, tmsState: TMSState): Partial<TMSState>;
}
```

`getTMSHandler(system)` is the factory — returns a handler wrapping the correct strategy's pure functions. Throws on unknown system.

### Handler Lifecycle Integration

Handlers are called from `app/page.tsx` at three points:

1. `initialize()` — called in `useEffect` on mount and when `settings.timeManagementSystem` or `tasks` change. DIT uses this for day rollover detection.
2. `onTaskCreated()` — called in `handleTaskSubmit()` after `addTask()`. DIT adds new tasks to Tomorrow.
3. `onTaskCompleted()` — called in `handleTaskComplete()` when `completed === true`. All strategies clean up their metadata.

Pattern at each call site:
```typescript
const handler = getTMSHandler(settings.timeManagementSystem);
const currentTmsState = useTMSStore.getState().state;
const delta = handler.onTaskCreated(newTask, currentTmsState);
if (Object.keys(delta).length > 0) {
  useTMSStore.getState().updateState(delta);
}
```

## Strategy Details

### Standard (NONE)

Passthrough — sorts by `task.order` ascending. All lifecycle methods return empty deltas. Active when no TMS is selected.

### Do It Tomorrow (DIT)

Tasks are scheduled into Today, Tomorrow, or Unscheduled buckets. New tasks auto-add to Tomorrow. Day rollover moves Tomorrow → Today on date change.

| State Field | Type | Purpose |
|-------------|------|---------|
| `dit.todayTasks` | `string[]` | Task IDs scheduled for today |
| `dit.tomorrowTasks` | `string[]` | Task IDs scheduled for tomorrow |
| `dit.lastDayChange` | `ISO datetime` | Timestamp of last rollover — compared date-only (`split('T')[0]`) |

Day rollover flow: `initialize()` called → compare `lastDayChange` date vs today → if different: `todayTasks = [...tomorrowTasks]`, `tomorrowTasks = []`, update `lastDayChange`.

UI: `DITView` renders 3 droppable zones (Today, Tomorrow, Unscheduled) with @dnd-kit drag-and-drop. Tasks can be moved between zones via DnD or arrow buttons. Sections scroll when >10 tasks (`max-h-[400px]`).

### Autofocus 4 (AF4)

Mark tasks you want to work on. Marked tasks appear first in the order they were marked.

| State Field | Type | Purpose |
|-------------|------|---------|
| `af4.markedTasks` | `string[]` | Set of marked task IDs |
| `af4.markedOrder` | `string[]` | Insertion-order tracking (same IDs as `markedTasks`) |

Ordering: `markedOrder.map(id → task)` first, then unmarked tasks in natural order. Duplicate mark prevention: `markTask` checks `includes()` before adding.

UI: `AF4View` renders Marked and Unmarked sections. Each task has a Star/Unmark toggle button. Completed tasks don't show the mark button.

### Final Version Perfected (FVP)

Pairwise comparison scan to build a prioritized "dotted" list. Work through dotted tasks in reverse order (last dotted = most urgent).

| State Field | Type | Purpose |
|-------------|------|---------|
| `fvp.dottedTasks` | `string[]` | Task IDs that have been dotted |
| `fvp.currentX` | `string \| null` | Reference task for pairwise comparison |
| `fvp.selectionInProgress` | `boolean` | Whether the selection UI is active |

Selection flow: `Start Selection` → sets first undotted task as X → for each subsequent undotted task: "Would you do this before X?" → Yes: dot it + set as new X → Skip: continue → `End Selection` → `selectionInProgress = false`.

Ordering: dotted tasks reversed (last dotted first), then undotted in natural order.

UI: `FVPView` renders a selection interface (when `selectionInProgress`) showing current X and comparison task with Yes/Skip buttons. Below: Dotted Tasks (work order) and Undotted Tasks sections. Reset button clears all dots.

Critical: `skipFVPTask()` is a no-op in the store — it exists for semantic clarity in the UI but doesn't change state. The "skip" just means "don't dot, continue to next comparison."

## TMSState Schema (Zod)

```typescript
TMSStateSchema = z.object({
  activeSystem: TimeManagementSystemSchema,  // 'none' | 'dit' | 'af4' | 'fvp'
  dit: z.object({
    todayTasks: z.array(z.string()),
    tomorrowTasks: z.array(z.string()),
    lastDayChange: z.string().datetime(),
  }),
  af4: z.object({
    markedTasks: z.array(z.string()),
    markedOrder: z.array(z.string()),
  }),
  fvp: z.object({
    dottedTasks: z.array(z.string()),
    currentX: z.string().nullable(),
    selectionInProgress: z.boolean(),
  }),
});
```

All three strategy sub-states exist simultaneously. Only `activeSystem` determines which is used.

## tmsStore (Zustand)

Persisted under key `task-management-tms` (version 1). Wraps `TMSState` in a `state` field.

### Actions

| Action | Strategy | Effect |
|--------|----------|--------|
| `setActiveSystem(system)` | All | Sets `state.activeSystem` |
| `addToToday(taskId)` | DIT | Appends to `dit.todayTasks` |
| `addToTomorrow(taskId)` | DIT | Appends to `dit.tomorrowTasks` |
| `moveToToday(taskId)` | DIT | Removes from tomorrow, adds to today |
| `moveToTomorrow(taskId)` | DIT | Removes from today, adds to tomorrow |
| `removeFromSchedule(taskId)` | DIT | Removes from both today and tomorrow |
| `performDayRollover()` | DIT | `todayTasks = tomorrowTasks`, clears tomorrow, updates `lastDayChange` |
| `markTask(taskId)` | AF4 | Adds to `markedTasks` + `markedOrder` (dedup check) |
| `unmarkTask(taskId)` | AF4 | Removes from both `markedTasks` and `markedOrder` |
| `startFVPSelection(firstTaskId)` | FVP | Clears dots, sets X, `selectionInProgress = true` |
| `selectFVPTask(taskId)` | FVP | Dots the task (dedup), sets as new X |
| `skipFVPTask()` | FVP | No-op (semantic placeholder) |
| `endFVPSelection()` | FVP | `selectionInProgress = false`, `currentX = null` |
| `resetFVP()` | FVP | Clears all FVP state |
| `updateState(delta)` | Generic | Shallow-merges delta into `state` (used by pure handlers) |
| `clearSystemMetadata()` | All | Resets all 3 strategy sub-states to defaults |

## Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `TMSSelector` | — | Select dropdown in settings. Confirmation dialog when switching away from active TMS. Calls `clearSystemMetadata()` + `setTimeManagementSystem()`. |
| `DITView` | `tasks, onTaskClick, onTaskComplete` | Today/Tomorrow/Unscheduled zones with @dnd-kit DnD + arrow buttons |
| `AF4View` | `tasks, onTaskClick, onTaskComplete` | Marked/Unmarked sections with Star toggle buttons |
| `FVPView` | `tasks, onTaskClick, onTaskComplete` | Selection interface + Dotted/Undotted sections with Reset |

All views support inline task editing via `InlineEditable` and task completion via `Checkbox`.

Critical: `TMSSelector` lives in `features/tms/` but the active system setting is stored in `appStore.settings.timeManagementSystem`, not in `tmsStore`. The selector writes to `appStore` via `setTimeManagementSystem()` and clears `tmsStore` via `clearSystemMetadata()`.

## Integration Points

| System | Integration | Details |
|--------|-------------|---------|
| `app/page.tsx` | Lifecycle wiring | Calls `initialize()`, `onTaskCreated()`, `onTaskCompleted()` on handlers |
| `appStore` | Active system setting | `settings.timeManagementSystem` — the source of truth for which TMS is active |
| `tmsStore` | Strategy metadata | All DIT/AF4/FVP state — persisted independently |
| `sharing` | Export/import | `tmsState` included in `AppState`. `ShareButton` filters TMS state to project-scoped task IDs via `filterTMSForProject()` |
| `useCrossTabSync` | Multi-tab sync | Rehydrates `tmsStore` on `storage` event for key `task-management-tms` |
| `lib/schemas.ts` | Validation | `TMSStateSchema` validates on import and `LocalStorageBackend` load |

### Sharing Integration Detail

`ShareButton.filterTMSForProject()` scopes TMS metadata to a single project's tasks:
- DIT: filters `todayTasks`/`tomorrowTasks` to project task IDs
- AF4: filters `markedTasks`/`markedOrder` to project task IDs
- FVP: filters `dottedTasks` to project task IDs, nullifies `currentX` if not in project

`ImportExportMenu` exports full `tmsStore.state` as `tmsState` in the JSON payload.

## Tuning Constants

```
PersistKey:              'task-management-tms' — Zustand persist key
PersistVersion:          1 — schema version
DIT_DragDistance:         8px — PointerSensor activation constraint
DIT_ScrollThreshold:     10 tasks — sections scroll at >10 items (max-h-[400px])
DIT_RolloverCheck:       date-only comparison (split('T')[0]) — no timezone handling
FVP_SkipAction:          no-op — skipFVPTask() changes no state
AF4_DedupCheck:          includes() — O(n) linear scan on mark
```

## Testing

### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `handlers/index.test.ts` | Factory function, all 4 handlers returned correctly, pure function interface |
| `handlers/StandardHandler.test.ts` | Sort by order, empty deltas |
| `handlers/AF4Handler.test.ts` | Mark/unmark ordering, completion cleanup |
| `handlers/FVPHandler.test.ts` | Dot ordering (reversed), completion cleanup, X reset |
| `handlers/DITHandler.test.ts` | Day rollover, today/tomorrow ordering, task lifecycle |
| `handlers/handlers.test.ts` | Cross-handler integration |
| `stores/tmsStore.test.ts` | All store actions, state mutations |
| `components/DITView.test.tsx` | Section rendering, task counts, drag handles, move buttons |

### Test Patterns

```typescript
// Create default TMS state for tests
const createDefaultTMSState = (): TMSState => ({
  activeSystem: TimeManagementSystem.NONE,
  dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
  af4: { markedTasks: [], markedOrder: [] },
  fvp: { dottedTasks: [], currentX: null, selectionInProgress: false },
});
```

### Regression Scenarios

1. DIT day rollover: verify `lastDayChange` date comparison handles timezone edge cases (currently date-only, no TZ)
2. AF4 duplicate mark: verify `markTask` is idempotent (returns unchanged state if already marked)
3. FVP completion of X: verify `currentX` is nullified and `selectionInProgress` set to false
4. Strategy switch: verify `clearSystemMetadata()` resets all 3 sub-states, not just the active one
5. Sharing filter: verify `filterTMSForProject()` correctly scopes all 3 strategy states to project tasks
6. Cross-tab sync: verify `tmsStore` rehydrates on `storage` event from another tab

## Key Files

| File | Description |
|------|-------------|
| `features/tms/handlers/index.ts` | Handler interface + `getTMSHandler()` factory |
| `features/tms/handlers/StandardHandler.ts` | Default sort-by-order strategy |
| `features/tms/handlers/DITHandler.ts` | Do It Tomorrow — day rollover + scheduling |
| `features/tms/handlers/AF4Handler.ts` | Autofocus 4 — mark-based prioritization |
| `features/tms/handlers/FVPHandler.ts` | Final Version Perfected — pairwise comparison |
| `features/tms/stores/tmsStore.ts` | Zustand store — all strategy metadata + actions |
| `features/tms/components/TMSSelector.tsx` | Strategy selection dropdown with confirmation |
| `features/tms/components/DITView.tsx` | DIT UI — 3 droppable zones with @dnd-kit |
| `features/tms/components/AF4View.tsx` | AF4 UI — marked/unmarked with star toggle |
| `features/tms/components/FVPView.tsx` | FVP UI — selection interface + dotted/undotted |
| `features/tms/index.ts` | Barrel export — public API |
| `lib/schemas.ts` | `TMSStateSchema` Zod definition |
| `types/index.ts` | `TimeManagementSystem` enum |
| `stores/appStore.ts` | `settings.timeManagementSystem` — active strategy |
| `app/page.tsx` | Handler lifecycle integration (init, create, complete) |
| `app/hooks/useCrossTabSync.ts` | Multi-tab rehydration for `tmsStore` |

## References

### Source Files
- `features/tms/handlers/index.ts` — handler interface + factory
- `features/tms/handlers/DITHandler.ts` — DIT pure functions
- `features/tms/handlers/AF4Handler.ts` — AF4 pure functions
- `features/tms/handlers/FVPHandler.ts` — FVP pure functions
- `features/tms/handlers/StandardHandler.ts` — default sort
- `features/tms/stores/tmsStore.ts` — Zustand store
- `features/tms/components/TMSSelector.tsx` — strategy selector
- `features/tms/components/DITView.tsx` — DIT view with DnD
- `features/tms/components/AF4View.tsx` — AF4 view
- `features/tms/components/FVPView.tsx` — FVP view
- `app/page.tsx` — handler lifecycle wiring
- `features/sharing/components/ShareButton.tsx` — `filterTMSForProject()`

### Related Context Docs
- [stores.md](stores.md) — tmsStore state shape, persistence keys, cross-tab sync
- [sharing.md](sharing.md) — TMS state export/import, project-scoped filtering
