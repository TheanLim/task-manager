# TMS Extensibility Architecture

## Problem Statement

The current `TMSState` schema is closed — every new TMS requires modifying
`lib/schemas.ts`, `tmsStore.ts`, `handlers/index.ts`, `TMSSelector.tsx`, and
`types/index.ts`. This document specifies the target architecture that makes
adding a new TMS a single-file addition with zero core changes.

---

## 1. State Shape

### Current (closed)

```ts
// lib/schemas.ts — must be edited for every new system
TMSStateSchema = z.object({
  activeSystem: TimeManagementSystemSchema,
  dit: z.object({ todayTasks, tomorrowTasks, lastDayChange }),
  af4: z.object({ markedTasks, markedOrder }),
  fvp: z.object({ dottedTasks, currentX, selectionInProgress }),
});
```

### Target (open)

```ts
// lib/schemas.ts — never needs to change again
export const TMSStateSchema = z.object({
  activeSystem: z.string().min(1),          // widened from enum to string
  systemStates: z.record(z.string(), z.unknown()), // keyed by system id
});

export type TMSState = z.infer<typeof TMSStateSchema>;
// { activeSystem: string; systemStates: Record<string, unknown> }
```

Each handler owns its own Zod schema and is responsible for validating/coercing
its slice of `systemStates[handler.id]`. The core schema never changes.

**What changes in `lib/schemas.ts`:**
- `TMSStateSchema` replaces the flat per-system sub-objects with `systemStates`
- `TimeManagementSystemSchema` stays as-is (still validates the four known values
  at the app-settings level); `activeSystem` in `TMSState` is widened to
  `z.string()` to allow third-party system IDs without an enum change

**What stays the same:**
- `AppStateSchema` still embeds `TMSStateSchema` — no change there
- `AppSettingsSchema.timeManagementSystem` still uses `TimeManagementSystemSchema`
  for the four built-in systems

---

## 2. Handler Interface

### Extended interface

```ts
// features/tms/handlers/index.ts

import { z } from 'zod';
import { Task } from '@/types';
import { ReactNode } from 'react';

/** Props passed to every TMS view component */
export interface TMSViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

/**
 * Full handler contract. Each TMS implements this interface.
 * Pure functions only — no store imports.
 */
export interface TimeManagementSystemHandler<S = unknown> {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Stable string key, e.g. "dit", "fvp". Used as the key in systemStates. */
  readonly id: string;
  /** Human-readable name shown in TMSSelector */
  readonly displayName: string;
  /** One-sentence description shown in TMSSelector */
  readonly description: string;

  // ── State contract ────────────────────────────────────────────────────────
  /** Zod schema for this system's state slice. Used for validation + migration. */
  readonly stateSchema: z.ZodType<S>;
  /** Returns a fresh default state for this system. */
  getInitialState(): S;
  /**
   * Parse and coerce raw unknown data (e.g. from localStorage) into valid S.
   * Implementations should call stateSchema.parse() or .safeParse() with
   * fallback to getInitialState() on failure.
   */
  validateState(raw: unknown): S;

  // ── Lifecycle hooks (pure — return deltas, never mutate) ──────────────────
  initialize(tasks: Task[], systemState: S): Partial<S>;
  getOrderedTasks(tasks: Task[], systemState: S): Task[];
  onTaskCreated(task: Task, systemState: S): Partial<S>;
  onTaskCompleted(task: Task, systemState: S): Partial<S>;

  // ── View ──────────────────────────────────────────────────────────────────
  /**
   * Render the system-specific UI panel.
   * Receives typed state + a typed dispatch — no store access inside the view.
   */
  renderView(props: TMSViewProps, state: S, dispatch: TMSDispatch<S>): ReactNode;
}

/**
 * Typed dispatch passed to renderView.
 * Replaces the grab-bag of hardcoded store actions.
 */
export type TMSDispatch<S> = (delta: Partial<S>) => void;
```

### Why `renderView` on the handler (not a separate component file)?

The handler already owns the state schema and initial state. Co-locating the
view factory keeps all system-specific knowledge in one place. The view receives
`state` and `dispatch` as plain props — it never calls `useTMSStore()` directly,
which satisfies the "no direct store imports in domain logic" rule.

The existing `DITView.tsx`, `AF4View.tsx`, `FVPView.tsx` files become thin
wrappers or are inlined into their handler's `renderView`. They can stay as
named exports for backwards compatibility during migration.

---

## 3. Store Design

### Target store

```ts
// features/tms/stores/tmsStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TMSState } from '@/types';

interface TMSStore {
  state: TMSState;

  setActiveSystem: (system: string) => void;

  /**
   * Generic state updater — the ONLY mutation path for system-specific state.
   * Merges delta shallowly into systemStates[systemId].
   */
  updateSystemState: (systemId: string, delta: Record<string, unknown>) => void;

  /**
   * Replace the entire state slice for a system (used during initialize()).
   */
  setSystemState: (systemId: string, state: unknown) => void;

  /**
   * Clear a single system's state (used when switching systems).
   */
  clearSystemState: (systemId: string) => void;

  /**
   * Clear ALL system states (nuclear reset).
   */
  clearAllSystemStates: () => void;
}

export const useTMSStore = create<TMSStore>()(
  persist(
    (set) => ({
      state: {
        activeSystem: 'none',
        systemStates: {},
      },

      setActiveSystem: (system) =>
        set((s) => ({ state: { ...s.state, activeSystem: system } })),

      updateSystemState: (systemId, delta) =>
        set((s) => ({
          state: {
            ...s.state,
            systemStates: {
              ...s.state.systemStates,
              [systemId]: {
                ...(s.state.systemStates[systemId] as object ?? {}),
                ...delta,
              },
            },
          },
        })),

      setSystemState: (systemId, newState) =>
        set((s) => ({
          state: {
            ...s.state,
            systemStates: {
              ...s.state.systemStates,
              [systemId]: newState,
            },
          },
        })),

      clearSystemState: (systemId) =>
        set((s) => {
          const { [systemId]: _, ...rest } = s.state.systemStates;
          return { state: { ...s.state, systemStates: rest } };
        }),

      clearAllSystemStates: () =>
        set((s) => ({ state: { ...s.state, systemStates: {} } })),
    }),
    {
      name: 'task-management-tms',
      version: 2,           // bump from 1 → triggers migrate()
      migrate: migrateTMSState,
    }
  )
);
```

**What disappears:** `addToToday`, `addToTomorrow`, `moveToToday`, `moveToTomorrow`,
`removeFromSchedule`, `performDayRollover`, `markTask`, `unmarkTask`,
`startFVPSelection`, `selectFVPTask`, `skipFVPTask`, `endFVPSelection`,
`resetFVP`, `clearSystemMetadata`, `updateState`.

All of these are replaced by `updateSystemState` + `setSystemState`. The
system-specific logic that was in these actions moves into the handler's
`renderView` dispatch callbacks.

### How View components access typed state

```ts
// Inside a handler's renderView (e.g. DITHandler)
renderView(props, state: DITState, dispatch) {
  // state is already typed as DITState — no casting needed
  const todayTasks = props.tasks.filter(t => state.todayTasks.includes(t.id));
  // ...
  return <DITView
    tasks={props.tasks}
    ditState={state}
    onMoveToToday={(id) => dispatch({ todayTasks: [...state.todayTasks, id] })}
    onTaskClick={props.onTaskClick}
    onTaskComplete={props.onTaskComplete}
  />;
}
```

The view component (`DITView`) becomes a pure presentational component — it
receives typed props and calls callbacks. No `useTMSStore()` inside.

### How the host renders the active system's view

```ts
// Wherever the TMS panel is rendered (e.g. a TaskList or sidebar component)
const { state } = useTMSStore();
const handler = getTMSHandler(state.activeSystem);
const systemState = handler.validateState(state.systemStates[handler.id]);
const dispatch: TMSDispatch<unknown> = (delta) =>
  useTMSStore.getState().updateSystemState(handler.id, delta as Record<string, unknown>);

return handler.renderView(viewProps, systemState, dispatch);
```

---

## 4. Registration Pattern

**Recommendation: Static registry object.**

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
  TMS_REGISTRY[handler.id] = handler;
}
```

**Why static registry over the alternatives:**

| Option | Pros | Cons |
|---|---|---|
| Static registry object | Simple, tree-shakeable, type-safe, no magic | Adding a system requires editing registry.ts |
| Dynamic `registerTMS()` | Flexible, runtime extensible | Ordering/timing issues, harder to tree-shake |
| Convention-based auto-discovery | Zero registration boilerplate | Requires bundler magic, opaque, hard to debug |

With four built-in systems and no plugin ecosystem requirement, the static
registry is the right call. The `registerTMSHandler` escape hatch covers tests
and any future dynamic need without committing to a full plugin API.

**`TMSSelector` becomes data-driven:**

```ts
// TMSSelector.tsx — no more hardcoded TMS_DESCRIPTIONS map
import { getAllTMSHandlers } from '../registry';

const handlers = getAllTMSHandlers();
// handlers[i].id, handlers[i].displayName, handlers[i].description
```

---

## 5. Migration Plan

### The problem

Existing localStorage under key `task-management-tms` (version 1) has shape:

```json
{
  "state": {
    "activeSystem": "dit",
    "dit": { "todayTasks": [...], "tomorrowTasks": [...], "lastDayChange": "..." },
    "af4": { "markedTasks": [...], "markedOrder": [...] },
    "fvp": { "dottedTasks": [...], "currentX": null, "selectionInProgress": false }
  },
  "version": 1
}
```

Target (version 2):

```json
{
  "state": {
    "activeSystem": "dit",
    "systemStates": {
      "dit": { "todayTasks": [...], "tomorrowTasks": [...], "lastDayChange": "..." },
      "af4": { "markedTasks": [...], "markedOrder": [...] },
      "fvp": { "dottedTasks": [...], "currentX": null, "selectionInProgress": false }
    }
  },
  "version": 2
}
```

### Migration function

```ts
// features/tms/stores/tmsStore.ts

function migrateTMSState(persistedState: unknown, version: number): TMSState {
  if (version === 1) {
    const v1 = persistedState as {
      state: {
        activeSystem: string;
        dit?: unknown;
        af4?: unknown;
        fvp?: unknown;
      };
    };
    const s = v1.state;
    return {
      activeSystem: s.activeSystem ?? 'none',
      systemStates: {
        ...(s.dit  ? { dit:  s.dit  } : {}),
        ...(s.af4  ? { af4:  s.af4  } : {}),
        ...(s.fvp  ? { fvp:  s.fvp  } : {}),
      },
    };
  }
  // Unknown version — return safe default
  return { activeSystem: 'none', systemStates: {} };
}
```

Pass this to Zustand's `persist` middleware:

```ts
persist(createFn, {
  name: 'task-management-tms',
  version: 2,
  migrate: migrateTMSState,
})
```

**Breaking change:** Yes — the localStorage schema changes. The migration
function handles it transparently for existing users. No data is lost; the
three system state blobs are lifted into `systemStates`.

**`AppStateSchema` in `lib/schemas.ts`:** The `tmsState` field in
`AppStateSchema` (used for JSON import/export) must also be updated to use the
new `TMSStateSchema`. The import/export migration path is the same lift — if
an imported file has the old shape, run it through `migrateTMSState` before
applying.

---

## 6. View Component Pattern

**Recommendation: Handler provides `renderView(props, state, dispatch)` factory.**

Rationale for each option:

| Option | Verdict |
|---|---|
| `renderView` on handler | ✅ Chosen. All system knowledge in one place. View is pure. |
| `useSystemState()` hook factory | ❌ Hook factories are awkward — hooks can't be called conditionally, and the factory pattern fights React's rules of hooks. |
| View receives state/dispatch as props (pure) | ✅ This is what `renderView` produces — the view component itself is pure. The handler is the factory that wires state → props. |

The view components (`DITView`, `AF4View`, `FVPView`) are refactored to:
1. Accept typed state + callbacks as props (no `useTMSStore()` inside)
2. Be called from their handler's `renderView` implementation

```ts
// Before (DITView.tsx)
const { state, moveToToday, moveToTomorrow } = useTMSStore(); // ❌ store coupling

// After (DITView.tsx)
interface DITViewProps extends TMSViewProps {
  ditState: DITState;
  onMoveToToday: (id: string) => void;
  onMoveToTomorrow: (id: string) => void;
  onRemoveFromSchedule: (id: string) => void;
}
// No useTMSStore() anywhere in the file ✅
```

---

## 7. Concrete Handler Shape (DIT as example)

```ts
// features/tms/handlers/DITHandler.ts

import { z } from 'zod';
import { Task } from '@/types';
import { TimeManagementSystemHandler, TMSViewProps, TMSDispatch } from './index';
import { DITView } from '../components/DITView';

const DITStateSchema = z.object({
  todayTasks:    z.array(z.string()),
  tomorrowTasks: z.array(z.string()),
  lastDayChange: z.string().datetime(),
});

type DITState = z.infer<typeof DITStateSchema>;

function getInitialState(): DITState {
  return {
    todayTasks:    [],
    tomorrowTasks: [],
    lastDayChange: new Date().toISOString(),
  };
}

export const DITHandler: TimeManagementSystemHandler<DITState> = {
  id:          'dit',
  displayName: 'Do It Tomorrow (DIT)',
  description: 'Organize tasks into Today and Tomorrow. Tasks roll over each day.',
  stateSchema:  DITStateSchema,

  getInitialState,

  validateState(raw: unknown): DITState {
    const result = DITStateSchema.safeParse(raw);
    return result.success ? result.data : getInitialState();
  },

  initialize(tasks, state): Partial<DITState> {
    const lastDay = state.lastDayChange.split('T')[0];
    const today   = new Date().toISOString().split('T')[0];
    if (lastDay !== today) {
      return {
        todayTasks:    [...state.tomorrowTasks],
        tomorrowTasks: [],
        lastDayChange: new Date().toISOString(),
      };
    }
    return {};
  },

  getOrderedTasks(tasks, state): Task[] {
    const todaySet    = new Set(state.todayTasks);
    const tomorrowSet = new Set(state.tomorrowTasks);
    return [
      ...tasks.filter(t => todaySet.has(t.id)),
      ...tasks.filter(t => tomorrowSet.has(t.id)),
      ...tasks.filter(t => !todaySet.has(t.id) && !tomorrowSet.has(t.id)),
    ];
  },

  onTaskCreated(task, state): Partial<DITState> {
    return { tomorrowTasks: [...state.tomorrowTasks, task.id] };
  },

  onTaskCompleted(task, state): Partial<DITState> {
    return {
      todayTasks:    state.todayTasks.filter(id => id !== task.id),
      tomorrowTasks: state.tomorrowTasks.filter(id => id !== task.id),
    };
  },

  renderView(props: TMSViewProps, state: DITState, dispatch: TMSDispatch<DITState>) {
    return (
      <DITView
        tasks={props.tasks}
        ditState={state}
        onTaskClick={props.onTaskClick}
        onTaskComplete={props.onTaskComplete}
        onMoveToToday={(id) =>
          dispatch({
            todayTasks:    [...state.todayTasks, id],
            tomorrowTasks: state.tomorrowTasks.filter(x => x !== id),
          })
        }
        onMoveToTomorrow={(id) =>
          dispatch({
            tomorrowTasks: [...state.tomorrowTasks, id],
            todayTasks:    state.todayTasks.filter(x => x !== id),
          })
        }
        onRemoveFromSchedule={(id) =>
          dispatch({
            todayTasks:    state.todayTasks.filter(x => x !== id),
            tomorrowTasks: state.tomorrowTasks.filter(x => x !== id),
          })
        }
      />
    );
  },
};
```

---

## 8. What Changes vs. What Stays the Same

### Changes (breaking)

| File | Change |
|---|---|
| `lib/schemas.ts` | `TMSStateSchema` — replace per-system sub-objects with `systemStates: z.record(z.unknown())` |
| `types/index.ts` | `TMSState` re-exported type changes shape |
| `features/tms/stores/tmsStore.ts` | Replace hardcoded actions with `updateSystemState` / `setSystemState`; bump version to 2; add `migrate` |
| `features/tms/handlers/index.ts` | Extend `TimeManagementSystemHandler` interface; replace `getTMSHandler` switch with registry lookup |
| `features/tms/handlers/DITHandler.ts` | Add `id`, `displayName`, `description`, `stateSchema`, `getInitialState`, `validateState`, `renderView`; change signatures from `(tasks, TMSState)` to `(tasks, DITState)` |
| `features/tms/handlers/AF4Handler.ts` | Same as DIT |
| `features/tms/handlers/FVPHandler.ts` | Same as DIT |
| `features/tms/handlers/StandardHandler.ts` | Same as DIT |
| `features/tms/components/DITView.tsx` | Remove `useTMSStore()` import; accept typed state + callbacks as props |
| `features/tms/components/AF4View.tsx` | Same as DIT |
| `features/tms/components/FVPView.tsx` | Same as DIT |
| `features/tms/components/TMSSelector.tsx` | Replace hardcoded `TMS_DESCRIPTIONS` with `getAllTMSHandlers()` |

### New files

| File | Purpose |
|---|---|
| `features/tms/registry.ts` | Static handler registry + `getTMSHandler` + `getAllTMSHandlers` + `registerTMSHandler` |

### Stays the same

| File | Why unchanged |
|---|---|
| `features/tms/index.ts` | Public barrel — same exports, just re-wired internally |
| `stores/appStore.ts` | `settings.timeManagementSystem` is independent of TMS state |
| `lib/schemas.ts` (rest) | `AppStateSchema`, `TaskSchema`, etc. untouched |
| Handler test files | Test signatures change (pass `DITState` not `TMSState`) but test logic is identical |
| `TimeManagementSystem` enum in `types/index.ts` | Still valid for the four built-in systems; `activeSystem` in `TMSState` is widened to `string` to allow future additions without enum changes |

---

## 9. Adding a New TMS (Post-Migration)

With this architecture, adding a fifth system (e.g. "Pomodoro") requires:

1. Create `features/tms/handlers/PomodoroHandler.ts` — implement `TimeManagementSystemHandler<PomodoroState>`
2. Add one line to `features/tms/registry.ts`: `[PomodoroHandler.id]: PomodoroHandler`
3. Create `features/tms/components/PomodoroView.tsx` (pure component, no store)

Zero changes to `lib/schemas.ts`, `tmsStore.ts`, `TMSSelector.tsx`, or `types/index.ts`.

---

## 10. Decision Log

| # | Decision | Rationale |
|---|---|---|
| D1 | `systemStates: Record<string, unknown>` not `Record<TimeManagementSystem, ...>` | Allows third-party system IDs without enum changes |
| D2 | Each handler owns its Zod schema | Keeps validation co-located with the state it validates; no central schema registry |
| D3 | `validateState` falls back to `getInitialState()` on parse failure | Corrupt/missing localStorage data degrades gracefully instead of crashing |
| D4 | Static registry, not dynamic registration | Simpler, tree-shakeable, no timing issues; `registerTMSHandler` escape hatch covers tests |
| D5 | `renderView` on handler, not a separate component file | All system knowledge in one place; view is pure (no store coupling) |
| D6 | `TMSDispatch<S>` typed to `Partial<S>` | Prevents views from dispatching arbitrary unknown shapes |
| D7 | Zustand `migrate` v1→v2 | Transparent for existing users; no data loss |
| D8 | `activeSystem` widened to `z.string()` in `TMSState` | Decouples state schema from the enum; enum still used in `AppSettings` for the four built-ins |
