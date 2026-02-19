# Time Management Systems (TMS)

Pluggable task-ordering strategies. The user picks a system; the app reorders their task list accordingly.

## Systems at a Glance

| System | Enum | Core Idea | Ordering Rule |
|--------|------|-----------|---------------|
| Standard | `NONE` | No system — plain list | Sort by `task.order` |
| Do It Tomorrow (DIT) | `DIT` | Defer new work; focus on today | Today → Tomorrow → Unscheduled |
| Autofocus 4 (AF4) | `AF4` | Mark what pulls you; work marks in order | Marked (in mark-order) → Unmarked |
| Final Version Perfected (FVP) | `FVP` | Pairwise "would I rather do X?" scan | Dotted (reverse order) → Undotted |

## Architecture

```
┌──────────────┐       getTMSHandler(system)       ┌────────────────────┐
│  tmsStore.ts │  ◄── state read ──────────────►   │  handlers/index.ts │
│  (Zustand)   │                                   │  (factory)         │
└──────┬───────┘                                   └────────┬───────────┘
       │                                                    │ dispatches to
       │  stores TMS metadata:                              ▼
       │  • dit.todayTasks/tomorrowTasks       ┌─────────────────────────┐
       │  • af4.markedTasks/markedOrder        │  AF4Handler.ts          │
       │  • fvp.dottedTasks/currentX           │  DITHandler.ts          │
       │                                       │  FVPHandler.ts          │
       │                                       │  StandardHandler.ts     │
       ▼                                       └─────────────────────────┘
  UI reads ordered tasks                        Pure fns: (tasks, tmsState) → Task[]
```

### Handler Interface

Every handler exports four pure functions matching `TimeManagementSystemHandler`:

```ts
initialize(tasks, tmsState)    → Partial<TMSState>   // setup / day-rollover
getOrderedTasks(tasks, tmsState) → Task[]             // reorder for display
onTaskCreated(task, tmsState)  → Partial<TMSState>    // lifecycle hook
onTaskCompleted(task, tmsState) → Partial<TMSState>   // lifecycle hook
```

`getTMSHandler(system)` returns the right handler object. Call sites read state from `useTMSStore`, pass it into the handler, then apply the returned delta via `updateState()`.

### Store (`tmsStore.ts`)

Zustand store persisted under key `task-management-tms`. Holds:

- `activeSystem` — which TMS is active
- `dit` — `todayTasks[]`, `tomorrowTasks[]`, `lastDayChange` (ISO datetime)
- `af4` — `markedTasks[]`, `markedOrder[]`
- `fvp` — `dottedTasks[]`, `currentX` (nullable task ID), `selectionInProgress`

Exposes granular actions per system plus a generic `updateState(delta)` for handler-returned deltas.

## System Details

### Standard (`NONE`)

No metadata. Tasks sorted by their `order` field. All lifecycle hooks are no-ops.

### Do It Tomorrow (DIT)

New tasks are added to **tomorrow**. Each day, `initialize()` checks `lastDayChange` — if the date has changed, tomorrow's tasks roll over to today and tomorrow is cleared. Focus on completing today's list; defer everything else.

- `getOrderedTasks`: today → tomorrow → unscheduled
- `onTaskCreated`: appends to `tomorrowTasks`
- `onTaskCompleted`: removes from both lists

### Autofocus 4 (AF4)

Scan your list and **mark** tasks that feel compelling. Marked tasks surface to the top in the order you marked them. Work through them sequentially.

- `getOrderedTasks`: marked (in mark-order) → unmarked (natural order)
- `onTaskCreated`: no-op (new tasks start unmarked)
- `onTaskCompleted`: removes mark if present

### Final Version Perfected (FVP)

A pairwise comparison scan. Set a reference task (**X**), then for each subsequent task ask "would I rather do this than X?" If yes, **dot** it and it becomes the new X. Dotted tasks are shown in reverse order (last dotted = highest priority).

- `getOrderedTasks`: dotted (reversed) → undotted (natural order)
- `onTaskCreated`: no-op
- `onTaskCompleted`: removes dot; resets `currentX` and `selectionInProgress` if the completed task was X
