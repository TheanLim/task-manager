# TMS Design Decisions

## 1. Pure-Function Handler Pattern

Handlers are pure functions: `(tasks, tmsState) → Task[] | Partial<TMSState>`. They never import stores or call side effects. Call sites are responsible for reading state, invoking the handler, and applying the returned delta via `useTMSStore.updateState()`.

**Why:** Keeps handlers testable without mocking Zustand. Aligns with the project rule "no direct store imports in domain logic."

## 2. Separate TMS Store

TMS metadata lives in its own Zustand store (`tmsStore.ts`, persisted as `task-management-tms`) rather than inside the main data store.

**Why:** TMS state is UI-strategy state, not domain data. Separating it avoids bloating the main store and lets the TMS system be swapped or reset without touching task data. Each system's sub-object (`dit`, `af4`, `fvp`) is always present — switching systems doesn't destroy other systems' metadata.

## 3. Factory Dispatch via `getTMSHandler`

A single factory function maps `TimeManagementSystem` enum → handler object. No class hierarchy, no registration — just a switch statement wrapping module-level function imports.

**Why:** Four systems is small enough that a switch is clearer than a registry. Adding a fifth system means adding one handler file and one case branch.

## 4. DIT Day-Rollover in `initialize()`

DIT's `initialize()` compares `lastDayChange` (date portion) against today. If the day changed, it moves `tomorrowTasks → todayTasks`, clears tomorrow, and updates the timestamp.

**Why:** Rollover is checked on system activation rather than on a timer. This avoids background scheduling and guarantees the user sees the correct day's tasks when they open the app.

## 5. AF4 Dual Arrays (`markedTasks` + `markedOrder`)

AF4 keeps both a `markedTasks` set (for fast lookup) and a `markedOrder` array (for display ordering). Both are updated together.

**Why:** `getOrderedTasks` needs insertion-order iteration (`markedOrder`), while mark/unmark checks need O(1) membership testing. Keeping both avoids repeated `indexOf` scans. The arrays are small enough that the duplication cost is negligible.

## 6. FVP Reverse-Order Display

Dotted tasks are displayed in reverse dotting order — the last task dotted appears first.

**Why:** In FVP, each newly dotted task "beats" the previous reference task X in a pairwise comparison. The most recently dotted task is therefore the highest-priority item. Reversing the array puts the winner on top.

## 7. FVP `currentX` and `selectionInProgress`

FVP tracks a `currentX` pointer (the reference task for pairwise comparison) and a `selectionInProgress` boolean. When the current X is completed, both are reset.

**Why:** The selection scan is stateful — the UI needs to know which task is being compared against and whether a scan is active. Resetting on X-completion prevents stale pointer references.

## 8. Lifecycle Hooks Return Deltas, Not Void

`onTaskCreated` and `onTaskCompleted` return `Partial<TMSState>` instead of mutating state directly. An empty object `{}` means "no change."

**Why:** Keeps handlers pure. The call site decides when and how to apply the delta (e.g., batching with other updates). Also makes it trivial to test: assert on the returned object without store setup.
