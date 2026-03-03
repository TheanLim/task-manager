---
name: stores
description: Zustand store conventions and state ownership
inclusion: fileMatch
fileMatchPattern: "stores/**/*,lib/repositories/**/*"
---

# Stores & State

Two top-level stores. No business logic lives here — stores are UI state caches that delegate mutations to services/repositories.

Note: `filterStore` lives at `features/tasks/stores/filterStore.ts`. `tmsStore` lives at `features/tms/stores/tmsStore.ts`.

## dataStore (`task-management-data`)

Entity cache + CRUD actions for projects, tasks, sections, dependencies, automationRules.

- CRUD actions delegate to service/repo singletons from `lib/serviceContainer.ts`
- Repository subscriptions sync state back via `subscribe` callbacks → `useDataStore.setState()`
- Domain events emitted on task/section mutations via `lib/events/` for the automation system
- Re-exports all service/repo singletons for consumers that import from `@/stores/dataStore`

## appStore (`task-management-settings`)

Persisted UI preferences. Key state:

| Field | Purpose |
|-------|---------|
| `settings` | Active project, theme, TMS mode, actionable-tasks toggle |
| `columnOrder` | Drag-reorderable task table columns (excludes `name`, always first) |
| `sortColumn` / `sortDirection` | Tri-state sort: asc → desc → clear |
| `needsAttentionSort` | Special sort mode for All Tasks page; clears column sort |
| `autoHideThreshold` | Completed task visibility: `show-all`, `24h`, `48h`, `1w`, `always` |
| `showRecentlyCompleted` | Show recently-done tasks within threshold window |
| `keyboardShortcuts` | User overrides only — merged with defaults at read time |
| `projectTabs` | Per-project active tab memory (synced with URL `?tab=`) |
| `globalTasksDisplayMode` | `nested` or `flat` for the All Tasks view |

## Rules

- Stores are read-through caches — never put cascade logic, ordering rules, or entity construction here
- Components read from stores reactively; call service methods for mutations
- `lib/serviceContainer.ts` is the composition root — all repos/services instantiated there as singletons
- `dataStore` imports and re-exports singletons; components should import from `@/stores/dataStore`
