# stores/ — Zustand State

Two stores at the top level, each with a distinct responsibility. No business logic lives here — stores are UI state caches that delegate mutations to services/repositories.

Note: `filterStore` moved to `features/tasks/stores/filterStore.ts` (only consumed by tasks-related code). `tmsStore` lives in `features/tms/stores/tmsStore.ts`.

## Quick Reference

| Store | Persisted? | Purpose |
|---|---|---|
| `dataStore` | Yes (`task-management-data`) | Entity cache + CRUD actions for projects, tasks, sections, dependencies, automationRules |
| `appStore` | Yes (`task-management-settings`) | UI preferences: theme, active project, column order, sort state, keyboard shortcuts, display modes |

## dataStore

The main entity store. Holds cached arrays of `projects`, `tasks`, `sections`, `dependencies`, and `automationRules`.

- CRUD actions (`addTask`, `updateProject`, `deleteSection`, etc.) delegate to service/repository singletons from `lib/serviceContainer.ts`.
- Repository subscriptions sync state back: when a repository writes, its `subscribe` callback calls `useDataStore.setState()`.
- Domain events are emitted on task/section mutations via `lib/events/` for the automation system.
- Re-exports all service/repo singletons from `serviceContainer` for consumers that import from `dataStore`.

## appStore

Persisted UI settings. Key state:

- `settings` — active project, theme (`light`/`dark`/`system`), time management system, actionable-tasks toggle
- `columnOrder` — drag-reorderable task table columns
- `sortColumn` / `sortDirection` — current sort state (tri-state: asc → desc → clear)
- `needsAttentionSort` — special sort mode for All Tasks page
- `autoHideThreshold` / `showRecentlyCompleted` — completed task visibility policy (`show-all`, `24h`, `48h`, `1w`, `always`)
- `keyboardShortcuts` — user overrides only (merged with defaults at read time)
- `projectTabs` — per-project active tab memory

## Wiring

`lib/serviceContainer.ts` is the composition root — it instantiates all repositories and services as singletons. `dataStore` imports and re-exports them. Components should import stores for reactive state and services for mutations.
