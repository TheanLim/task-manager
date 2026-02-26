# TMS Extensibility Architecture

## Problem Statement

The current `TMSState` schema is closed — every new TMS requires modifying
`lib/schemas.ts`, `tmsStore.ts`, `handlers/index.ts`, `TMSSelector.tsx`, and
`types/index.ts`. This document specifies the target architecture that makes
adding a new TMS a single-file addition with zero core changes.

This document incorporates feedback from three reviewers: Lead SDE Architect,
PM, and Power User. Reviewer notes are called out inline where they changed
a decision.

---

## 1. State Shape

### Current (closed)

```ts
// lib/schemas.ts — must be edited for every new system
TMSStateSchema = z.object({
  activeSystem: TimeManagementSystemSchema,
  dit: z.object({ todayTasks, tomorrowTasks, lastDayChange }),
  af4: z.object({ backlogTaskIds, activeListTaskIds, currentPosition, ... }),
  fvp: z.object({ dottedTasks, scanPosition }),
});
```

### Target (open)

```ts
// lib/schemas.ts — never needs to change again
export const TMSStateSchema = z.object({
  activeSystem: z.string().min(1),
  systemStates: z.record(z.string(), z.unknown()),
  systemStateVersions: z.record(z.string(), z.number()).default({}),
});
export type TMSState = z.infer<typeof TMSStateSchema>;
```

Each handler owns its own Zod schema and validates its slice of
`systemStates[handler.id]`. The core schema never changes.

**Why `systemStateVersions` is a top-level field (not embedded in the blob):**
The previous design embedded `__stateVersion` inside each system's state blob.
This caused Zod validation failures because handler schemas (e.g. `FVPStateSchema`)
don't declare `__stateVersion` as a field. Moving versions to a parallel
`systemStateVersions` map keeps each handler's schema clean and avoids
`.passthrough()` hacks.

**What changes in `lib/schemas.ts`:**
- `TMSStateSchema` replaces per-system sub-objects with `systemStates`
- `systemStateVersions` tracks per-handler schema versions separately
- `TimeManagementSystemSchema` stays as-is for `AppSettingsSchema`
- `activeSystem` widened to `z.string()` to allow future IDs without enum changes

**What stays the same:**
- `AppStateSchema` still embeds `TMSStateSchema`
- `AppSettingsSchema.timeManagementSystem` still uses `TimeManagementSystemSchema`


---

## 2. Handler Interface

### Revised interface (post-review)

```ts
// features/tms/handlers/index.ts

import { z } from 'zod';
import { ComponentType } from 'react';
import { Task } from '@/types';

/** Props passed to every TMS view component */
export interface TMSViewProps<S = unknown> {
  tasks: Task[];
  systemState: S;
  dispatch: TMSDispatch<unknown>;
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

/**
 * Semantic action dispatch — views emit named actions, not raw state deltas.
 * Each handler defines its own ActionMap type.
 */
export type TMSDispatch<A> = (action: A) => void;

/**
 * Full handler contract. Pure functions only — no store imports.
 */
export interface TimeManagementSystemHandler<S = unknown, A = unknown> {
  // ── Identity ──────────────────────────────────────────────────────────────
  readonly id: string;
  readonly displayName: string;
  readonly description: string;

  // ── State contract ────────────────────────────────────────────────────────
  readonly stateSchema: z.ZodType<S>;
  readonly stateVersion: number;
  getInitialState(): S;
  validateState(raw: unknown): S;          // falls back to getInitialState() on failure
  migrateState(fromVersion: number, raw: unknown): S;

  // ── Lifecycle hooks (pure — return deltas, never mutate) ──────────────────
  /**
   * Called when the user switches TO this system.
   * Return value is merged with getInitialState() — {} means "use defaults".
   * Called on every activation, including resume (use currentState to detect).
   */
  onActivate(tasks: Task[], currentState: S): Partial<S>;

  /**
   * Called when the user switches AWAY from this system.
   * Use to reset transient UI state (e.g. selectionInProgress).
   */
  onDeactivate(currentState: S): Partial<S>;

  getOrderedTasks(tasks: Task[], systemState: S): Task[];
  onTaskCreated(task: Task, systemState: S): Partial<S>;
  onTaskCompleted(task: Task, systemState: S): Partial<S>;
  onTaskDeleted(taskId: string, systemState: S): Partial<S>;

  // ── Action reducer ────────────────────────────────────────────────────────
  /**
   * Pure reducer: given the current state and a semantic action, return a
   * partial state delta. Views dispatch actions; this function applies them.
   */
  reduce(state: S, action: A): Partial<S>;

  // ── View binding ──────────────────────────────────────────────────────────
  /**
   * Returns the React component type for this system's view.
   * The component receives TMSViewProps<S> — no store access inside.
   */
  getViewComponent(): ComponentType<TMSViewProps<S>>;
}
```

### Key changes from original design (reviewer-driven)

**`renderView` → `getViewComponent()`** (Architect, PM)

The original `renderView(props, state, dispatch): ReactNode` mixed rendering
into domain logic, required a React environment to test handlers, and prevented
memoization. `getViewComponent()` returns a `ComponentType` reference — React
manages the lifecycle, and handler tests remain pure unit tests.

```ts
// Host renders the active system's view:
const handler = getTMSHandler(activeSystemId);
const ViewComponent = handler.getViewComponent();
// <ViewComponent tasks={tasks} systemState={state} dispatch={dispatch} ... />
```

**`TMSDispatch<A>` with semantic actions** (Architect)

The original `TMSDispatch<S> = (delta: Partial<S>) => void` let views dispatch
arbitrary raw state mutations — a violation of rules.md #2 (no business logic
in UI). Each handler now defines its own action union, and `reduce(state, action)`
applies it. Views dispatch named actions; handlers decide what state changes result.

**`onActivate` / `onDeactivate` lifecycle** (Architect, Power User)

- `onActivate` — called when user switches TO this system. Return merges with
  `getInitialState()`. `{}` means "use defaults unchanged."
- `onDeactivate` — called when user switches AWAY. Use to reset transient state
  (e.g. FVP's `selectionInProgress`, AF4's `phase`).

**`onTaskDeleted`** (Power User)

Missing from the original. Without it, deleted task IDs linger in
`dottedTasks`/`backlogTaskIds`, and `scanPosition`/`currentPosition` become
stale indices. FVP breaks silently if the deleted task was the current X.

**`stateVersion` + `migrateState`** (Architect)

Per-handler versioning isolates migrations. When a handler's state shape changes,
you don't need a global Zustand version bump.

```ts
// In DITHandler:
stateVersion: 2,
migrateState(fromVersion, raw): DITState {
  if (fromVersion === 1) {
    return { ...(raw as any), lastDayChange: new Date().toISOString() };
  }
  return this.validateState(raw);
},
```


---

## 3. Store Design

### Target store

```ts
// features/tms/stores/tmsStore.ts

interface TMSStore {
  state: TMSState;

  setActiveSystem: (system: string) => void;

  /**
   * Apply a partial delta to a system's state slice (shallow merge).
   * This is the ONLY mutation path — called by the host after handler.reduce().
   * Optionally bumps the persisted version for this system.
   */
  applySystemStateDelta: (
    systemId: string,
    delta: Record<string, unknown>,
    newVersion?: number
  ) => void;

  /**
   * Replace the entire state slice for a system (used during onActivate).
   */
  setSystemState: (systemId: string, state: unknown, version?: number) => void;

  /**
   * Clear a single system's state (used for explicit "reset this system").
   */
  clearSystemState: (systemId: string) => void;
}
```

**What disappears:** All hardcoded system-specific actions (`addToToday`,
`markTask`, `startFVPSelection`, etc.) and the old `updateState(delta: Partial<TMSState>)`.

**What replaces them:** `applySystemStateDelta` — called by the host component
after `handler.reduce(state, action)` returns a delta. The store is a dumb
key-value container; it has no knowledge of any system's internals.

### How the host wires dispatch

```ts
// In TMSHost.tsx:
const { state, applySystemStateDelta } = useTMSStore();
const handler = getTMSHandler(state.activeSystem);

const raw = state.systemStates[handler.id];
const persistedVersion = state.systemStateVersions[handler.id] ?? 1;
const systemState = persistedVersion < handler.stateVersion
  ? handler.migrateState(persistedVersion, raw)
  : handler.validateState(raw);

const dispatch = useCallback((action: unknown) => {
  const delta = handler.reduce(systemState, action);
  applySystemStateDelta(handler.id, delta as Record<string, unknown>);
}, [handler, systemState, applySystemStateDelta]);

const ViewComponent = handler.getViewComponent();
return (
  <ErrorBoundary fallback={<TMSErrorFallback />}>
    <TMSTabBar />
    <ViewComponent
      tasks={tasks}
      systemState={systemState}
      dispatch={dispatch}
      onTaskClick={onTaskClick}
      onTaskComplete={onTaskComplete}
    />
  </ErrorBoundary>
);
```

### System switching

When the user switches systems, the host calls:
1. `handler.onDeactivate(currentState)` → `applySystemStateDelta` to persist clean state
2. `setActiveSystem(newSystemId)`
3. `newHandler.onActivate(tasks, existingState)` → `applySystemStateDelta` to initialize

Old system state is **preserved** in `systemStates` by default (not cleared).
Switching back to FVP resumes where you left off. `clearSystemState` is available
for an explicit "reset this system" action.

### `applySystemStateDelta` implementation

```ts
applySystemStateDelta: (systemId, delta, newVersion) =>
  set(s => ({
    state: {
      ...s.state,
      systemStates: {
        ...s.state.systemStates,
        [systemId]: { ...(s.state.systemStates[systemId] as object ?? {}), ...delta },
      },
      systemStateVersions: newVersion !== undefined
        ? { ...s.state.systemStateVersions, [systemId]: newVersion }
        : s.state.systemStateVersions,
    },
  })),
```


---

## 4. Registration Pattern

**Static registry object** — unchanged from original design.

```ts
// features/tms/registry.ts

import { TimeManagementSystemHandler } from './handlers';
import { DITHandler } from './handlers/DITHandler';
import { AF4Handler } from './handlers/AF4Handler';
import { FVPHandler } from './handlers/FVPHandler';
import { StandardHandler } from './handlers/StandardHandler';

const TMS_REGISTRY: Record<string, TimeManagementSystemHandler> = {
  [DITHandler.id]:      DITHandler,
  [AF4Handler.id]:      AF4Handler,
  [FVPHandler.id]:      FVPHandler,
  [StandardHandler.id]: StandardHandler,
};

export function getTMSHandler(id: string): TimeManagementSystemHandler {
  const handler = TMS_REGISTRY[id];
  if (!handler) throw new Error(`Unknown TMS: "${id}"`);
  return handler;
}

export function getAllTMSHandlers(): TimeManagementSystemHandler[] {
  return Object.values(TMS_REGISTRY);
}

/** For tests and future dynamic registration */
export function registerTMSHandler(handler: TimeManagementSystemHandler): void {
  // Validate at registration time — catch misconfigured handlers early
  handler.validateState(handler.getInitialState()); // must not throw
  TMS_REGISTRY[handler.id] = handler;
}
```

**Validation at registration time** (Architect): `registerTMSHandler` calls
`validateState(getInitialState())` to catch misconfigured handlers at startup,
not at runtime when a user switches to a broken system.

**Tab bar becomes data-driven** (see Section 4a):

```ts
import { getAllTMSHandlers } from '../registry';
const handlers = getAllTMSHandlers();
// handlers[i].id, handlers[i].displayName, handlers[i].description
```

---

## 4a. Tab Bar as System Switcher (Fix 4)

**Decision: The tab bar IS the system switcher.** There is no TMSSelector dropdown
in settings. The `TMSTabBar` component is always visible at the top of the TMS panel.

```ts
// features/tms/components/TMSTabBar.tsx

interface TMSTabBarProps {
  activeSystemId: string;
  systemStates: Record<string, unknown>;
  onSwitch: (systemId: string) => void;
}

export function TMSTabBar({ activeSystemId, systemStates, onSwitch }: TMSTabBarProps) {
  const handlers = getAllTMSHandlers();
  return (
    <div role="tablist" className="flex gap-1 border-b mb-4">
      {handlers.map(h => {
        const isActive = h.id === activeSystemId;
        const hasState = !!systemStates[h.id];
        const isResumed = !isActive && hasState;
        return (
          <button
            key={h.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSwitch(h.id)}
            className={`px-3 py-2 text-sm rounded-t relative ${
              isActive ? 'bg-teal-600 text-white' : 'hover:bg-accent'
            }`}
          >
            {h.displayName}
            {isResumed && (
              <span className="ml-1 text-xs bg-teal-100 text-teal-700 px-1 rounded">
                Resumed
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

**Behavior:**
- Clicking a tab triggers: `onDeactivate` → `setActiveSystem` → `onActivate`
- Active tab: teal background
- "Resumed" pill: shown on inactive tabs that have non-empty `systemStates[id]`
- Keyboard: standard `role="tablist"` arrow-key navigation


---

## 5. Migration Plan

### localStorage: Zustand persist v1 → v2

Existing shape (version 1):
```json
{
  "state": {
    "activeSystem": "dit",
    "dit": { "todayTasks": [], "tomorrowTasks": [], "lastDayChange": "..." },
    "af4": { "backlogTaskIds": [], "activeListTaskIds": [], "currentPosition": 0,
             "lastPassHadWork": false, "passStartPosition": 0, "dismissedTaskIds": [], "phase": "backlog" },
    "fvp": { "dottedTasks": [], "scanPosition": 1 }
  },
  "version": 1
}
```

Target shape (version 2):
```json
{
  "state": {
    "activeSystem": "dit",
    "systemStates": {
      "dit": { "todayTasks": [], "tomorrowTasks": [], "lastDayChange": "..." },
      "af4": { "backlogTaskIds": [], "activeListTaskIds": [], "currentPosition": 0,
               "lastPassHadWork": false, "dismissedTaskIds": [], "phase": "backlog" },
      "fvp": { "dottedTasks": [], "scanPosition": 1 }
    },
    "systemStateVersions": { "dit": 1, "af4": 1, "fvp": 1 }
  },
  "version": 2
}
```

Note: `passStartPosition` is dropped during migration (it was dead state — see Section 7).

Migration function (lives in `tmsStore.ts`, passed to Zustand `persist` `migrate` option):

```ts
function migrateTMSState(persistedState: unknown, version: number): TMSState {
  if (version === 1) {
    const s = (persistedState as any)?.state ?? {};
    return {
      activeSystem: (s.activeSystem as string) ?? 'none',
      systemStates: {
        ...(s.dit  ? { dit:  s.dit  } : {}),
        ...(s.af4  ? { af4:  s.af4  } : {}),
        ...(s.fvp  ? { fvp:  s.fvp  } : {}),
      },
      systemStateVersions: {
        ...(s.dit  ? { dit:  1 } : {}),
        ...(s.af4  ? { af4:  1 } : {}),
        ...(s.fvp  ? { fvp:  1 } : {}),
      },
    };
  }
  // Unknown/corrupt version — safe default, no crash
  return { activeSystem: 'none', systemStates: {}, systemStateVersions: {} };
}
```

**Explicit fallback behavior** (PM): any unknown or corrupt version returns
`{ activeSystem: 'none', systemStates: {}, systemStateVersions: {} }` — the user
loses TMS state but the app does not crash. This is documented, not implicit.

### Per-handler state migration

After the global v1→v2 lift, each handler's `migrateState(fromVersion, raw)` is
called when the host loads a system's state slice:

```ts
// In TMSHost.tsx, when resolving systemState:
const raw = state.systemStates[handler.id];
const persistedVersion = state.systemStateVersions[handler.id] ?? 1;
const systemState = persistedVersion < handler.stateVersion
  ? handler.migrateState(persistedVersion, raw)
  : handler.validateState(raw);
```

This isolates handler-level schema changes from the global Zustand version.

### JSON import/export (AppStateSchema)

The `tmsState` field in `AppStateSchema` (used for JSON import/export) must
also use the new `TMSStateSchema`. If an imported file has the old flat shape,
run it through `migrateTMSState` before applying. This logic lives in
`lib/importExport.ts`, not duplicated in the store.

**Migration must be tested** (PM): write unit tests covering:
- v1 with all three systems populated
- v1 with only one system populated
- v1 with `activeSystem: 'none'`
- completely missing/null persisted state
- unknown version number


---

## 6. View Component Pattern

**Decision: `getViewComponent()` returning a `ComponentType`** (revised from original)

The original `renderView(props, state, dispatch): ReactNode` was rejected by
both the Architect and PM for these reasons:
- Mixes rendering into domain logic — handler now imports React/JSX
- Requires a render environment to test handler logic
- Prevents React from managing component lifecycle and memoization

The revised pattern:

```ts
// Handler declares its view component type:
getViewComponent(): ComponentType<TMSViewProps<DITState>> {
  return DITView; // just a reference, not a call
}

// DITView is a pure presentational component:
export function DITView({ tasks, systemState, dispatch, onTaskClick, onTaskComplete }: TMSViewProps<DITState>) {
  // No useTMSStore() — state comes in as props
  // dispatch emits semantic actions: dispatch({ type: 'MOVE_TO_TODAY', taskId })
}
```

### StandardHandler view (Fix 3)

`StandardHandler` returns the existing `GlobalTasksView` (or a thin wrapper) as
its view component. It receives extra props via an extended interface:

```ts
interface StandardViewProps extends TMSViewProps<StandardState> {
  // StandardState is minimal: {}
  // These come from appStore, passed by the host when activeSystem === 'none'
  needsAttentionSort: boolean;
  onReinsert: (taskId: string) => void;
  hideCompletedTasks: boolean;
}
```

The host component reads `needsAttentionSort`, `onReinsert`, and `hideCompletedTasks`
from `appStore` and passes them when `activeSystem === 'none'`. This keeps
`StandardHandler` a proper handler while preserving the existing Review Queue behavior.

**Current state (as of feat/tms-algorithm-corrections branch):** `FVPView.tsx`
and `AF4View.tsx` still call `useTMSStore()` directly and use `updateState`.
They have not yet been migrated to the `TMSViewProps` pattern. This is a known
gap to address in the extensibility migration.

---

## 7. Known Bugs in Current Implementation

These were identified by the Power User reviewer and must be fixed before or
during the extensibility migration.

### Bug 1 — FVP: `completeCurrentTask` position bug

`completeCurrentTask` computes `completedIndex` from `tasks.filter(t => !t.completed)`
*after* the caller has already marked the task complete. `findIndex` returns `-1`,
so `scanPosition` resets to 0 instead of advancing past the completed task.

**Fix:** compute the index before the task is marked complete, or pass the task's
pre-completion index as a parameter. The handler function must receive the full
unfiltered task list at the moment of the call, before the completion flag is set.

### Bug 2 — AF4: `passStartPosition` is dead state

`passStartPosition` is stored and initialized but never read by `isFullPassComplete`.
Either use it for proper full-pass detection or remove it. Decision: **remove it**.
`isFullPassComplete` detects end-of-list by `currentPosition >= list.length`, which
is sufficient. Removing it simplifies the state shape and eliminates the migration
concern.

### Bug 3 — AF4: `didWork` conflates "progress" with "completion"

`didWork` calls `onTaskComplete(..., true)` which marks the task fully done.
AF4's "did work" means "I made progress — cross off and re-enter at end of Active
List." These are semantically different. A task worked on for 20 minutes but not
finished should re-enter the Active List, not be marked complete.

**Fix:** Rename `didWork` to `MADE_PROGRESS` in the action union. `MADE_PROGRESS`
does NOT call `onTaskComplete` on the global task store — it only moves the task
within AF4 state. A separate `MARK_DONE` action marks the task actually complete.
See the full AF4Action union in Section 8.

### Bug 4 — AF4: `resolveDismissed` is unreachable

`resolveDismissed` (abandon / re-enter / defer) is fully implemented in
`AF4Handler.ts` but never called from `AF4View.tsx`. Dismissed tasks accumulate
with a warning icon and no resolution UI. The resolution dialog/flow is missing.

**Fix:** Add a `ResolveDismissedDialog` component to `AF4View.tsx` that appears
when dismissed tasks exist. It lists each dismissed task with three action buttons.

### Bug 5 — FVP: Missing `onTaskDeleted` handling

If a task is deleted while it's in `dottedTasks`, the ID lingers and
`getCurrentTask` returns `null` silently. If the deleted task was the current X
(second-to-last dotted), the preselection comparison breaks.

**Fix:** Implement `onTaskDeleted` in `FVPHandler` — remove the ID from
`dottedTasks` and recalculate `scanPosition` if the deleted task was before it.

### Bug 6 — AF4: Missing `onTaskDeleted` handling

Deleted task IDs linger in `backlogTaskIds`/`activeListTaskIds`. If the deleted
task was at `currentPosition`, the cursor points to the wrong task.

**Fix:** Implement `onTaskDeleted` in `AF4Handler` — remove from both lists and
adjust `currentPosition` if the deleted task was at or before the cursor.


---

## 8. Concrete Handler Shapes

### DIT Handler (reference implementation)

```ts
// features/tms/handlers/DITHandler.ts

const DITStateSchema = z.object({
  todayTasks:    z.array(z.string().min(1)),
  tomorrowTasks: z.array(z.string().min(1)),
  lastDayChange: z.string().datetime(),
});
type DITState = z.infer<typeof DITStateSchema>;

type DITAction =
  | { type: 'MOVE_TO_TODAY';        taskId: string }
  | { type: 'MOVE_TO_TOMORROW';     taskId: string }
  | { type: 'REMOVE_FROM_SCHEDULE'; taskId: string };

export const DITHandler: TimeManagementSystemHandler<DITState, DITAction> = {
  id: 'dit', displayName: 'Do It Tomorrow (DIT)',
  description: 'Organize tasks into Today and Tomorrow. Tasks roll over each day.',
  stateSchema: DITStateSchema, stateVersion: 1,
  getInitialState: () => ({ todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() }),
  validateState(raw) { const r = DITStateSchema.safeParse(raw); return r.success ? r.data : this.getInitialState(); },
  migrateState(_v, raw) { return this.validateState(raw); },
  onActivate(_tasks, currentState) {
    const lastDay = currentState.lastDayChange.split('T')[0];
    const today   = new Date().toISOString().split('T')[0];
    if (lastDay !== today) {
      return { todayTasks: [...currentState.tomorrowTasks], tomorrowTasks: [], lastDayChange: new Date().toISOString() };
    }
    return {};
  },
  onDeactivate(_state) { return {}; },
  getOrderedTasks(tasks, state) {
    const todaySet = new Set(state.todayTasks); const tomorrowSet = new Set(state.tomorrowTasks);
    return [
      ...tasks.filter(t => todaySet.has(t.id)),
      ...tasks.filter(t => tomorrowSet.has(t.id)),
      ...tasks.filter(t => !todaySet.has(t.id) && !tomorrowSet.has(t.id)),
    ];
  },
  onTaskCreated(task, state) { return { tomorrowTasks: [...state.tomorrowTasks, task.id] }; },
  onTaskCompleted(task, state) {
    return { todayTasks: state.todayTasks.filter(id => id !== task.id),
             tomorrowTasks: state.tomorrowTasks.filter(id => id !== task.id) };
  },
  onTaskDeleted(taskId, state) {
    return { todayTasks: state.todayTasks.filter(id => id !== taskId),
             tomorrowTasks: state.tomorrowTasks.filter(id => id !== taskId) };
  },
  reduce(state, action) {
    switch (action.type) {
      case 'MOVE_TO_TODAY':
        return { todayTasks: [...state.todayTasks, action.taskId],
                 tomorrowTasks: state.tomorrowTasks.filter(x => x !== action.taskId) };
      case 'MOVE_TO_TOMORROW':
        return { tomorrowTasks: [...state.tomorrowTasks, action.taskId],
                 todayTasks: state.todayTasks.filter(x => x !== action.taskId) };
      case 'REMOVE_FROM_SCHEDULE':
        return { todayTasks: state.todayTasks.filter(x => x !== action.taskId),
                 tomorrowTasks: state.tomorrowTasks.filter(x => x !== action.taskId) };
    }
  },
  getViewComponent() { return DITView; },
};
```

### AF4 Action Union (Fix 2 — full definition)

```ts
type AF4Action =
  | { type: 'MADE_PROGRESS' }                                              // cross off backlog, re-enter Active List; task NOT marked complete
  | { type: 'MARK_DONE' }                                                  // mark task actually complete in global store
  | { type: 'SKIP' }                                                       // advance cursor
  | { type: 'FLAG_DISMISSED' }                                             // mark current task as stubborn
  | { type: 'RESOLVE_DISMISSED'; taskId: string; resolution: 'abandon' | 're-enter' | 'defer' }
  | { type: 'ADVANCE_AFTER_PASS' }                                         // called when pass is complete
  | { type: 'PROMOTE_ACTIVE_LIST' };                                       // when backlog empty, promote active list
```

`MADE_PROGRESS` does NOT call `onTaskComplete` on the global task store.
It only moves the task within AF4 state (backlog → end of active list).
The view dispatches `MADE_PROGRESS`; the host does NOT mark the task complete.

`MARK_DONE` is dispatched when the user explicitly marks a task done. The host
calls `onTaskComplete(taskId, true)` on the global store AND dispatches `MARK_DONE`
to the handler so it can clean up its lists.

### StandardHandler (minimal)

```ts
const StandardStateSchema = z.object({});
type StandardState = z.infer<typeof StandardStateSchema>;
type StandardAction = never;

export const StandardHandler: TimeManagementSystemHandler<StandardState, StandardAction> = {
  id: 'none', displayName: 'Review Queue', description: 'Tasks sorted by last action date.',
  stateSchema: StandardStateSchema, stateVersion: 1,
  getInitialState: () => ({}),
  validateState(_raw) { return {}; },
  migrateState(_v, _raw) { return {}; },
  onActivate(_tasks, _state) { return {}; },
  onDeactivate(_state) { return {}; },
  getOrderedTasks(tasks, _state) { return tasks; }, // host applies needsAttentionSort
  onTaskCreated(_task, _state) { return {}; },
  onTaskCompleted(_task, _state) { return {}; },
  onTaskDeleted(_taskId, _state) { return {}; },
  reduce(_state, _action) { return {}; },
  getViewComponent() { return StandardView; },
};
```


---

## 9. What Changes vs. What Stays the Same

### Changes (breaking)

| File | Change |
|---|---|
| `lib/schemas.ts` | `TMSStateSchema` → `systemStates: z.record(z.unknown())` + `systemStateVersions` |
| `types/index.ts` | `TMSState` re-exported type changes shape |
| `features/tms/stores/tmsStore.ts` | Replace hardcoded actions with `applySystemStateDelta`/`setSystemState`; bump version to 2; add `migrate` |
| `features/tms/handlers/index.ts` | Extend interface: add `onActivate`, `onDeactivate`, `onTaskDeleted`, `reduce`, `getViewComponent`, `stateVersion`, `migrateState` |
| `features/tms/handlers/DITHandler.ts` | Implement new interface |
| `features/tms/handlers/AF4Handler.ts` | Implement new interface + fix all bugs + new AF4Action union |
| `features/tms/handlers/FVPHandler.ts` | Implement new interface + fix all bugs |
| `features/tms/handlers/StandardHandler.ts` | Implement new interface |
| `features/tms/components/DITView.tsx` | Remove `useTMSStore()`; accept `TMSViewProps<DITState>` |
| `features/tms/components/AF4View.tsx` | Same + add `ResolveDismissedDialog` |
| `features/tms/components/FVPView.tsx` | Same |
| `features/tms/components/TMSSelector.tsx` | Replace with `TMSTabBar` |

### New files

| File | Purpose |
|---|---|
| `features/tms/registry.ts` | Static handler registry |
| `features/tms/components/TMSTabBar.tsx` | Tab bar system switcher |
| `features/tms/components/TMSHost.tsx` | Host wiring: dispatch, lifecycle, error boundary |
| `features/tms/components/StandardView.tsx` | Wrapper around GlobalTasksView |
| `features/tms/components/shared/TaskCard.tsx` | Shared task card component |
| `features/tms/components/shared/SectionHeader.tsx` | Shared section header |
| `features/tms/components/shared/TMSEmptyState.tsx` | Shared empty state |

### Stays the same

| File | Why |
|---|---|
| `features/tms/index.ts` | Public barrel — same exports |
| `stores/appStore.ts` | `settings.timeManagementSystem` is independent |
| `lib/schemas.ts` (rest) | `AppStateSchema`, `TaskSchema`, etc. untouched |
| `TimeManagementSystem` enum | Still valid for four built-ins |

---

## 10. Adding a New TMS (Post-Migration)

1. Create `features/tms/handlers/NewHandler.ts` — implement `TimeManagementSystemHandler<NewState, NewAction>`
2. Create `features/tms/components/NewView.tsx` — pure component, accepts `TMSViewProps<NewState>`
3. Add one line to `features/tms/registry.ts`: `[NewHandler.id]: NewHandler`

Zero changes to `lib/schemas.ts`, `tmsStore.ts`, `TMSTabBar.tsx`, or `types/index.ts`.

---

## 11. Implementation Order

Each step leaves the app in a working state.

1. **Fix known bugs** (Section 7) — `completeCurrentTask` position, remove `passStartPosition`, `didWork` → `MADE_PROGRESS`, `resolveDismissed` UI, `onTaskDeleted` for both handlers
2. **Write migration tests** — cover all v1 edge cases before touching the store
3. **Update `TMSStateSchema`** in `lib/schemas.ts` → `systemStates` + `systemStateVersions`
4. **Add `migrate` + bump version to 2** in `tmsStore.ts`; replace hardcoded actions with `applySystemStateDelta`
5. **Create `features/tms/registry.ts`** with static registry
6. **Extend `TimeManagementSystemHandler` interface** in `handlers/index.ts`
7. **Migrate handlers** one at a time: `StandardHandler` → `DITHandler` → `AF4Handler` → `FVPHandler`
8. **Create shared components** (`TaskCard`, `SectionHeader`, `TMSEmptyState`)
9. **Create `TMSTabBar`** and **`TMSHost`**
10. **Migrate view components** to `TMSViewProps<S>` pattern (remove `useTMSStore()`)
11. **Replace `TMSSelector`** with `TMSTabBar`
12. **Add error boundaries** per system in `TMSHost`

---

## 12. Decision Log

| # | Decision | Rationale | Reviewer |
|---|---|---|---|
| D1 | `systemStates: Record<string, unknown>` | Allows future system IDs without enum changes | Original |
| D2 | Each handler owns its Zod schema | Validation co-located with state | Original |
| D3 | `validateState` falls back to `getInitialState()` | Corrupt localStorage degrades gracefully | Original |
| D4 | Static registry, not dynamic | Simpler, tree-shakeable, no timing issues | Original |
| D5 | `getViewComponent()` not `renderView()` | Keeps domain logic pure; React manages lifecycle | Architect, PM |
| D6 | Semantic `TMSDispatch<A>` not raw `Partial<S>` | Views must not dispatch raw state mutations (rules.md #2) | Architect |
| D7 | Zustand `migrate` v1→v2 | Transparent for existing users; no data loss | Original |
| D8 | `activeSystem` widened to `z.string()` | Decouples state schema from enum | Original |
| D9 | `onActivate` / `onDeactivate` lifecycle | Replaces ambiguous `initialize`; enables clean system switching | Architect, Power User |
| D10 | `onTaskDeleted` lifecycle hook | Prevents stale IDs breaking FVP/AF4 state | Power User |
| D11 | Per-handler `stateVersion` + `migrateState` | Isolates handler schema changes from global Zustand version | Architect |
| D12 | Old system state preserved on switch (not cleared) | Switching back to FVP resumes where you left off | PM |
| D13 | `onDeactivate` resets transient state | FVP `selectionInProgress`, AF4 `phase` should not persist across switches | Architect |
| D14 | Validation at `registerTMSHandler` time | Catch misconfigured handlers at startup, not at user interaction | Architect |
| D15 | Error boundary per system in host | Broken handler doesn't take down whole TMS panel | Architect |
| D16 | Migration fallback = `{ activeSystem: 'none', systemStates: {}, systemStateVersions: {} }` | Explicit, documented behavior — no silent corruption | PM |
| D17 | `systemStateVersions` as top-level field | Avoids `__stateVersion` leaking into handler Zod schemas | Architect |
| D18 | Tab bar is the system switcher (no settings dropdown) | Switching is a primary action; always visible | PM, Power User |
| D19 | `MADE_PROGRESS` ≠ `MARK_DONE` in AF4 | "Did work" and "task complete" are semantically different | Power User |
| D20 | `passStartPosition` removed | Dead state — never read; `currentPosition >= list.length` is sufficient | Architect |
| D21 | `StandardHandler` wraps `GlobalTasksView` | Preserves Review Queue behavior without special-casing in host | Architect |


---

## 13. TDD Unit Test Specifications

All tests use Vitest. Handlers are pure functions — no mocks needed. Store tests
use `useTMSStore.getState()` directly (no React render required).

### FVPHandler

```ts
describe('FVPHandler', () => {
  describe('initialize', () => {
    it('resets dottedTasks to [] and scanPosition to 1')
    it('returns same delta regardless of existing state (always clean reset)')
  })

  describe('getOrderedTasks', () => {
    it('returns dotted tasks first in oldest→newest order')
    it('returns undotted incomplete tasks after dotted, in natural order')
    it('returns completed tasks last (not in dottedTasks)')
    it('handles empty dottedTasks — returns all incomplete then completed in natural order')
    it('skips dotted IDs that no longer exist in the task list')
  })

  describe('dotTask', () => {
    it('appends candidateId to dottedTasks')
    it('sets scanPosition to candidateIndex + 1 (in incomplete list)')
    it('does not duplicate if already dotted — appends anyway (caller must guard)')
  })

  describe('skipTask', () => {
    it('advances scanPosition past the candidate (candidateIndex + 1)')
    it('does not modify dottedTasks')
    it('preserves all other fvp state fields')
  })

  describe('completeCurrentTask', () => {
    it('removes last dotted task from dottedTasks')
    it('sets scanPosition to completedIndex + 1 computed from the UNFILTERED incomplete list at call time')
    it('resets scanPosition to 1 when dottedTasks becomes empty after removal')
    it('returns empty delta when dottedTasks is already empty')
    it('does not depend on task.completed flag — uses position in list at call time')
  })

  describe('onTaskDeleted', () => {
    it('removes deleted taskId from dottedTasks')
    it('recalculates scanPosition when deleted task was at an index before scanPosition in the incomplete list')
    it('does not change scanPosition when deleted task was at or after scanPosition')
    it('handles deletion of the current X (second-to-last dotted) without crashing')
    it('returns empty delta when taskId is not in dottedTasks')
    it('handles deletion of a task that is both dotted and the current task (last dotted)')
  })

  describe('getCurrentTask', () => {
    it('returns last dotted task')
    it('returns null when dottedTasks is empty')
    it('returns null when last dotted task ID no longer exists in tasks array')
  })

  describe('getCurrentX', () => {
    it('returns second-to-last dotted task when dottedTasks.length >= 2')
    it('returns first undotted incomplete task when dottedTasks.length === 1')
    it('returns first undotted incomplete task when dottedTasks.length === 0')
    it('returns null when no undotted incomplete tasks exist and dottedTasks.length < 2')
  })

  describe('getScanCandidate', () => {
    it('returns first undotted incomplete task at or after scanPosition in the incomplete list')
    it('skips dotted tasks when scanning forward')
    it('skips completed tasks (they are not in the incomplete list)')
    it('returns null when all tasks at or after scanPosition are dotted')
    it('returns null when scanPosition >= incomplete.length')
  })

  describe('onTaskCompleted (external completion)', () => {
    it('removes task from dottedTasks if present')
    it('returns empty delta when completing an undotted task')
    it('does not change scanPosition on external completion')
  })

  describe('resetFVP', () => {
    it('clears all dotted tasks and resets scanPosition to 1')
  })
})
```

### AF4Handler

```ts
describe('AF4Handler', () => {
  describe('initialize', () => {
    it('puts all incomplete tasks into backlog in their natural order')
    it('sets activeListTaskIds to []')
    it('sets currentPosition to 0, phase to backlog, lastPassHadWork to false')
    it('excludes already-completed tasks from backlog')
    it('handles empty task list — backlog is []')
  })

  describe('getOrderedTasks', () => {
    it('returns backlog tasks first in backlog order')
    it('returns active list tasks after backlog')
    it('returns unlisted tasks (not in either list) at the end')
    it('skips IDs that no longer exist in the task list')
  })

  describe('MADE_PROGRESS action (via reduce)', () => {
    it('removes task from backlog')
    it('re-enters task at end of active list')
    it('does NOT mark the task complete in global store (no onTaskComplete call)')
    it('sets lastPassHadWork to true')
    it('currentPosition stays the same (now points to next task after removal)')
    it('returns empty delta when currentPosition is past end of list')
  })

  describe('SKIP action (via reduce)', () => {
    it('increments currentPosition by 1')
    it('does not modify backlog or active list')
  })

  describe('ADVANCE_AFTER_PASS action (via reduce)', () => {
    it('switches to active phase when backlog pass had no work')
    it('resets currentPosition to 0 when switching to active phase')
    it('restarts backlog from 0 when backlog pass had work, resets lastPassHadWork')
    it('returns to backlog after active pass completes')
    it('promotes active list to new backlog when all backlog tasks are completed')
    it('clears activeListTaskIds after promotion')
  })

  describe('FLAG_DISMISSED action (via reduce)', () => {
    it('adds current task to dismissedTaskIds')
    it('is idempotent — does not duplicate if already dismissed')
    it('advances cursor after flagging (same as SKIP)')
  })

  describe('RESOLVE_DISMISSED action (via reduce)', () => {
    it('abandon: removes task from all lists and dismissedTaskIds')
    it('re-enter: moves task from backlog to end of active list, removes from dismissed')
    it('defer: removes from dismissedTaskIds only, task stays in backlog')
    it('handles taskId not in any list gracefully (no crash)')
  })

  describe('PROMOTE_ACTIVE_LIST action (via reduce)', () => {
    it('moves all activeListTaskIds to backlogTaskIds')
    it('clears activeListTaskIds')
    it('resets currentPosition to 0 and phase to backlog')
  })

  describe('onTaskDeleted', () => {
    it('removes taskId from backlogTaskIds')
    it('removes taskId from activeListTaskIds')
    it('removes taskId from dismissedTaskIds')
    it('decrements currentPosition when deleted task was before cursor in current phase list')
    it('does not change currentPosition when deleted task was at or after cursor')
    it('clamps currentPosition to 0 (never negative)')
    it('returns empty delta when taskId not in any list')
  })

  describe('onTaskCompleted (external)', () => {
    it('removes task from backlog')
    it('removes task from active list')
    it('decrements currentPosition when completed task was before cursor')
    it('does not change currentPosition when completed task is at or after cursor')
    it('returns empty delta for task not in either list')
  })

  describe('isFullPassComplete', () => {
    it('returns true when currentPosition >= list.length for current phase')
    it('returns false when still within the list')
    it('uses backlog list when phase is backlog')
    it('uses active list when phase is active')
  })

  describe('getCurrentTask', () => {
    it('returns task at currentPosition in backlog phase')
    it('returns task at currentPosition in active phase')
    it('returns null when list is empty')
    it('returns null when currentPosition is past end of list')
  })
})
```

### DITHandler

```ts
describe('DITHandler', () => {
  describe('onActivate — day rollover', () => {
    it('moves tomorrowTasks to todayTasks when lastDayChange is a previous day')
    it('clears tomorrowTasks after rollover')
    it('updates lastDayChange to today after rollover')
    it('returns {} (no change) when lastDayChange is already today')
    it('handles empty tomorrowTasks on rollover — todayTasks becomes []')
  })

  describe('getOrderedTasks', () => {
    it('returns today tasks first in todayTasks order')
    it('returns tomorrow tasks after today tasks')
    it('returns unscheduled tasks (not in either list) last')
    it('handles tasks that appear in both lists (edge case — today wins)')
  })

  describe('onTaskCreated', () => {
    it('appends new task to end of tomorrowTasks')
    it('does not modify todayTasks')
  })

  describe('onTaskCompleted', () => {
    it('removes task from todayTasks')
    it('removes task from tomorrowTasks')
    it('returns empty delta when task is in neither list')
  })

  describe('onTaskDeleted', () => {
    it('removes taskId from todayTasks')
    it('removes taskId from tomorrowTasks')
    it('returns empty delta when taskId is in neither list')
  })

  describe('reduce', () => {
    describe('MOVE_TO_TODAY', () => {
      it('adds taskId to todayTasks')
      it('removes taskId from tomorrowTasks if present')
      it('does not duplicate if already in todayTasks')
    })
    describe('MOVE_TO_TOMORROW', () => {
      it('adds taskId to tomorrowTasks')
      it('removes taskId from todayTasks if present')
    })
    describe('REMOVE_FROM_SCHEDULE', () => {
      it('removes taskId from both todayTasks and tomorrowTasks')
      it('returns empty-ish delta when task is in neither list')
    })
  })
})
```

### StandardHandler

```ts
describe('StandardHandler', () => {
  describe('getOrderedTasks', () => {
    it('returns tasks in the order provided (natural order — host applies sorting)')
    it('returns empty array for empty input')
  })

  describe('onActivate / onDeactivate', () => {
    it('onActivate returns {} (no state to initialize)')
    it('onDeactivate returns {} (no transient state to reset)')
  })

  describe('onTaskDeleted / onTaskCompleted / onTaskCreated', () => {
    it('all return {} — StandardHandler has no state to maintain')
  })
})
```

### tmsStore

```ts
describe('tmsStore', () => {
  describe('applySystemStateDelta', () => {
    it('shallow-merges delta into existing systemStates[id]')
    it('creates the key if it did not exist')
    it('does not affect other system states')
    it('bumps systemStateVersions[id] when newVersion is provided')
    it('does not change systemStateVersions when newVersion is omitted')
  })

  describe('setSystemState', () => {
    it('replaces the entire state slice for a system')
    it('sets systemStateVersions[id] when version is provided')
    it('does not affect other system states')
  })

  describe('clearSystemState', () => {
    it('removes the key from systemStates')
    it('removes the key from systemStateVersions')
    it('does not affect other system states')
  })

  describe('setActiveSystem', () => {
    it('updates state.activeSystem')
    it('does not modify systemStates')
  })

  describe('systemStateVersions tracking', () => {
    it('starts empty {}')
    it('is updated by applySystemStateDelta with newVersion')
    it('is updated by setSystemState with version')
    it('is cleared per-key by clearSystemState')
  })

  describe('migration v1 → v2', () => {
    it('v1 with all three systems: lifts dit/af4/fvp into systemStates, sets versions to 1')
    it('v1 with only dit populated: only dit key appears in systemStates')
    it('v1 with activeSystem none: activeSystem is none, systemStates is {}')
    it('null/missing persisted state: returns safe default { activeSystem: none, systemStates: {}, systemStateVersions: {} }')
    it('unknown version number: returns safe default')
    it('v1 af4 state: passStartPosition is dropped (not carried into v2)')
  })
})
```


---

## 14. E2E Test Specifications

All e2e tests use Playwright. Each spec file seeds tasks via the app's import
mechanism or direct localStorage injection before navigating to the TMS panel.

### FVP System (`e2e/tms-fvp.spec.ts`)

```ts
describe('FVP System', () => {
  beforeEach(async ({ page }) => {
    // seed 5 tasks, activate FVP via tab bar
  })

  it('shows "Start Preselection" button when no dotted tasks exist')
  it('shows preselection comparison panel after clicking Start Preselection')
  it('preselection panel shows current X description and candidate description')
  it('clicking "Yes — dot it" adds candidate to dotted list and updates X')
  it('clicking "No — skip" advances to next candidate without dotting')
  it('Do Now section shows the last dotted task')
  it('clicking Done on current task removes it from dotted list and advances scan')
  it('preselection panel disappears when no more candidates remain')
  it('Reset button clears all dots and resets scan position')
  it('deleting a task that is the current X does not crash the view')
  it('deleting a task that is the current Do Now task does not crash the view')
  it('switching away from FVP and back resumes state (same dotted tasks)')
  it('shows "Resumed" pill on FVP tab when switching back with existing state')
  it('completing all dotted tasks shows empty state message')
})
```

### AF4 System (`e2e/tms-af4.spec.ts`)

```ts
describe('AF4 System', () => {
  beforeEach(async ({ page }) => {
    // seed 6 tasks, activate AF4 via tab bar
  })

  it('initialize: all existing tasks appear in Backlog, Active List is empty')
  it('new tasks created after activation appear in Active List, not Backlog')
  it('MADE_PROGRESS: current task moves from Backlog to end of Active List')
  it('MADE_PROGRESS: task is NOT marked complete (checkbox stays unchecked)')
  it('SKIP: advances cursor to next Backlog task without moving the task')
  it('pass-complete transition: reaching end of Backlog with no work switches to Active List pass')
  it('pass-complete transition: reaching end of Backlog WITH work restarts Backlog from top')
  it('active-list pass: after active pass completes, returns to Backlog')
  it('backlog promotion: when all Backlog tasks are done, Active List becomes new Backlog')
  it('flag dismissed: clicking flag icon adds task to dismissed list with warning icon')
  it('resolve dismissed — abandon: removes task from all lists')
  it('resolve dismissed — re-enter: moves task to end of Active List')
  it('resolve dismissed — defer: removes from dismissed, task stays in Backlog')
  it('ResolveDismissedDialog appears when dismissed tasks exist')
  it('deleting a task at the cursor position does not skip the next task')
  it('MARK_DONE: marks task complete and removes from lists')
})
```

### DIT System (`e2e/tms-dit.spec.ts`)

```ts
describe('DIT System', () => {
  beforeEach(async ({ page }) => {
    // seed tasks, activate DIT via tab bar
  })

  it('shows Today and Tomorrow zones')
  it('new tasks created while DIT is active appear in Tomorrow zone')
  it('Move to Today button moves task from Tomorrow to Today zone')
  it('Move to Tomorrow button moves task from Today to Tomorrow zone')
  it('Remove from Schedule removes task from both zones (appears as unscheduled)')
  it('day rollover: when lastDayChange is yesterday, Tomorrow tasks move to Today on activate')
  it('day rollover: Today tasks from previous day are cleared (not carried forward)')
  it('day rollover can be tested by mocking Date — inject via page.evaluate')
  it('unscheduled tasks appear below both zones')
  it('completing a task removes it from its zone')
  it('deleting a task removes it from its zone')
})
```

### Review Queue / Standard System (`e2e/tms-standard.spec.ts`)

```ts
describe('Review Queue (Standard)', () => {
  beforeEach(async ({ page }) => {
    // seed tasks with varying lastActionAt, activate Standard via tab bar
  })

  it('tasks are sorted by lastActionAt when needsAttentionSort is enabled')
  it('reinsert button is only shown on the top task')
  it('clicking reinsert moves task to end of list and updates lastActionAt')
  it('needs-attention indicator appears on tasks not actioned recently')
  it('hideCompletedTasks hides completed tasks when enabled')
  it('disabling needsAttentionSort shows tasks in natural order')
})
```

### System Switching (`e2e/tms-system-switching.spec.ts`)

```ts
describe('System Switching', () => {
  it('switching from FVP to AF4 calls FVP onDeactivate (resets selectionInProgress)')
  it('switching from AF4 to DIT calls AF4 onDeactivate')
  it('switching back to FVP resumes dotted tasks from before the switch')
  it('switching back to AF4 resumes backlog/active list from before the switch')
  it('switching to a system for the first time calls onActivate with empty state')
  it('switching to DIT on a new day triggers day rollover')
  it('all four systems are reachable via tab bar')
  it('active tab has teal background')
  it('inactive tab with saved state shows Resumed pill')
  it('inactive tab without saved state shows no pill')
  it('error in one system view does not crash other systems (error boundary)')
})
```

### Tab Bar (`e2e/tms-tab-bar.spec.ts`)

```ts
describe('TMSTabBar', () => {
  it('renders one tab per registered handler')
  it('active tab has aria-selected=true')
  it('clicking a tab switches the active system')
  it('keyboard: ArrowRight moves focus to next tab')
  it('keyboard: ArrowLeft moves focus to previous tab')
  it('keyboard: Enter/Space activates focused tab')
  it('keyboard: wraps from last tab to first on ArrowRight')
  it('keyboard: wraps from first tab to last on ArrowLeft')
  it('Resumed pill appears on tab with saved state that is not active')
  it('Resumed pill disappears when that tab becomes active')
  it('tab bar is always visible regardless of active system')
})
```


---

## 15. Implementation Checklist

A flat checklist of every file to create or modify, in implementation order.
Each phase leaves the app in a working state.

### Phase 1: Bug Fixes (no architecture changes)

- [ ] `features/tms/handlers/FVPHandler.ts` — fix `completeCurrentTask` position bug (compute index before task is marked complete)
- [ ] `features/tms/handlers/FVPHandler.ts` — add `onTaskDeleted` (remove from dottedTasks, recalculate scanPosition)
- [ ] `features/tms/handlers/AF4Handler.ts` — fix `didWork` semantics → rename to `MADE_PROGRESS`, do NOT call `onTaskComplete`
- [ ] `features/tms/handlers/AF4Handler.ts` — remove `passStartPosition` from state shape and all usages
- [ ] `features/tms/handlers/AF4Handler.ts` — add `onTaskDeleted` (remove from both lists, adjust cursor)
- [ ] `features/tms/components/AF4View.tsx` — add `ResolveDismissedDialog` component for dismissed task resolution
- [ ] `features/tms/handlers/FVPHandler.test.ts` — update `completeCurrentTask` tests; add `onTaskDeleted` tests
- [ ] `features/tms/handlers/AF4Handler.test.ts` — update `didWork` → `MADE_PROGRESS` tests; add `onTaskDeleted` tests; remove `passStartPosition` assertions

### Phase 2: Schema + Store Migration

- [ ] `lib/schemas.ts` — add `systemStateVersions: z.record(z.string(), z.number()).default({})` to `TMSStateSchema`
- [ ] `lib/schemas.ts` — replace per-system sub-objects with `systemStates: z.record(z.string(), z.unknown())`
- [ ] `features/tms/stores/tmsStore.ts` — add `migrateTMSState` function (v1→v2 lift)
- [ ] `features/tms/stores/tmsStore.ts` — bump Zustand persist version to 2, wire `migrate`
- [ ] `features/tms/stores/tmsStore.ts` — replace all hardcoded actions with `applySystemStateDelta` / `setSystemState` / `clearSystemState`
- [ ] `features/tms/stores/tmsStore.ts` — add `systemStateVersions` tracking to `applySystemStateDelta` and `setSystemState`
- [ ] `features/tms/stores/tmsStore.test.ts` — rewrite: migration tests (all 6 edge cases) + new action tests; remove old hardcoded-action tests

### Phase 3: Handler Interface + Registry

- [ ] `features/tms/handlers/index.ts` — extend interface: add `onActivate`, `onDeactivate`, `onTaskDeleted`, `reduce`, `getViewComponent`, `stateVersion`, `migrateState`
- [ ] `features/tms/registry.ts` — create static registry with `getTMSHandler`, `getAllTMSHandlers`, `registerTMSHandler`
- [ ] `features/tms/handlers/StandardHandler.ts` — implement full interface (minimal state, wraps GlobalTasksView)
- [ ] `features/tms/handlers/DITHandler.ts` — implement full interface + `DITAction` union
- [ ] `features/tms/handlers/AF4Handler.ts` — implement full interface + `AF4Action` union (with `MADE_PROGRESS`, `MARK_DONE`, etc.)
- [ ] `features/tms/handlers/FVPHandler.ts` — implement full interface + `FVPAction` union
- [ ] `features/tms/handlers/DITHandler.test.ts` — create: all DITHandler unit tests from Section 13
- [ ] `features/tms/handlers/StandardHandler.test.ts` — create: minimal StandardHandler tests from Section 13

### Phase 4: Shared Components + Host

- [ ] `features/tms/components/shared/TaskCard.tsx` — create shared task card (checkbox, description, priority badge, due date)
- [ ] `features/tms/components/shared/SectionHeader.tsx` — create shared section header (title + count badge)
- [ ] `features/tms/components/shared/TMSEmptyState.tsx` — create shared empty state component
- [ ] `features/tms/components/TMSTabBar.tsx` — create tab bar (data-driven from `getAllTMSHandlers()`, Resumed pill, keyboard nav)
- [ ] `features/tms/components/TMSHost.tsx` — create host: dispatch wiring, lifecycle calls, error boundary, tab bar
- [ ] `features/tms/components/StandardView.tsx` — create wrapper around GlobalTasksView accepting `TMSViewProps<StandardState>`

### Phase 5: View Migration

- [ ] `features/tms/components/DITView.tsx` — remove `useTMSStore()`; accept `TMSViewProps<DITState>`; dispatch `DITAction`
- [ ] `features/tms/components/FVPView.tsx` — remove `useTMSStore()`; accept `TMSViewProps<FVPState>`; dispatch `FVPAction`
- [ ] `features/tms/components/AF4View.tsx` — remove `useTMSStore()`; accept `TMSViewProps<AF4State>`; dispatch `AF4Action`; wire `ResolveDismissedDialog`

### Phase 6: Integration + Cleanup

- [ ] `features/tms/components/TMSSelector.tsx` — replace with `TMSTabBar` (or delete if TMSHost renders it directly)
- [ ] `features/tms/index.ts` — update barrel exports (add registry, TMSHost, TMSTabBar)
- [ ] All handler test files — verify all tests pass against new interface signatures
- [ ] `e2e/tms-fvp.spec.ts` — create (specs from Section 14)
- [ ] `e2e/tms-af4.spec.ts` — create (specs from Section 14)
- [ ] `e2e/tms-dit.spec.ts` — create (specs from Section 14)
- [ ] `e2e/tms-standard.spec.ts` — create (specs from Section 14)
- [ ] `e2e/tms-system-switching.spec.ts` — create (specs from Section 14)
- [ ] `e2e/tms-tab-bar.spec.ts` — create (specs from Section 14)

### Verification gates (must pass before merging each phase)

- Phase 1: `npx vitest run features/tms/handlers` — all pass
- Phase 2: `npx vitest run features/tms/stores` — all pass; `npx next build` — no errors
- Phase 3: `npx vitest run features/tms/handlers` — all pass
- Phase 4–5: `npx next build` — no SWC/Webpack errors; `npx vitest run` — all pass
- Phase 6: `npx vitest run` — all pass; `npm run lint` — clean; `npx playwright test e2e/tms-*` — all pass
