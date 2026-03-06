<!-- v1 | last-verified: 2025-07-14 -->
# Zustand Stores

Five Zustand stores manage all client-side state. Two top-level stores (`dataStore`, `appStore`) are persisted and shared app-wide. Three feature-level stores (`tmsStore`, `filterStore`, `keyboardNavStore`) are scoped to their features — two persisted, one transient.

## Store Inventory

| Store | Export | Persist Key | Persisted | Scope |
|-------|--------|-------------|-----------|-------|
| `useDataStore` | `stores/dataStore.ts` | `task-management-data` | Yes | Entity cache + CRUD actions |
| `useAppStore` | `stores/appStore.ts` | `task-management-settings` | Yes | UI preferences, sort, columns, shortcuts |
| `useTMSStore` | `features/tms/stores/tmsStore.ts` | `task-management-tms` | Yes | DIT/AF4/FVP strategy metadata |
| `useFilterStore` | `features/tasks/stores/filterStore.ts` | — | No (transient) | Search query, priority/date/completion filters |
| `useKeyboardNavStore` | `features/keyboard/stores/keyboardNavStore.ts` | — | No (transient) | Focused task ID + active grid cell |

## dataStore — Entity Cache + CRUD

The central store. Holds cached arrays of all entities and exposes CRUD actions that delegate to the repository/service layer. Components read from Zustand state; writes go through repos which notify back via subscriptions.

### State Shape

| Field | Type | Source |
|-------|------|--------|
| `projects` | `Project[]` | `projectRepository` subscription |
| `tasks` | `Task[]` | `taskRepository` subscription |
| `sections` | `Section[]` | `sectionRepository` subscription |
| `dependencies` | `TaskDependency[]` | `dependencyRepository` subscription |
| `automationRules` | `AutomationRule[]` | `automationRuleRepository` subscription |

### CRUD Actions

| Action | Delegates To | Domain Event | Notes |
|--------|-------------|--------------|-------|
| `addProject(project)` | `projectService.createWithDefaults()` | — | Service creates 3 default sections |
| `updateProject(id, updates)` | `projectRepository.update()` | — | Adds `updatedAt` timestamp |
| `deleteProject(id)` | `projectService.cascadeDelete()` | — | Cascade: rules → tasks → subtasks → deps → sections → project |
| `addTask(task)` | `taskRepository.create()` | `task.created` | Wrapped in `beginBatch/endBatch` |
| `updateTask(id, updates)` | `taskRepository.update()` | `task.updated` | Captures `previousValues`, tracks `movedToSectionAt` |
| `deleteTask(id)` | `taskService.cascadeDelete()` | `task.deleted` | Captures task data before deletion |
| `addSection(section)` | `sectionRepository.create()` | `section.created` | Wrapped in batch |
| `updateSection(id, updates)` | `sectionRepository.update()` | `section.updated` | Captures `previousValues` |
| `deleteSection(id)` | `sectionService.cascadeDelete()` | — | Service handles cascade |
| `toggleSectionCollapsed(id)` | `sectionRepository.update()` | — | No domain event |
| `addDependency(dep)` | `dependencyRepository.create()` | — | No domain event |
| `deleteDependency(id)` | `dependencyRepository.delete()` | — | No domain event |

### Selectors

| Selector | Returns | Notes |
|----------|---------|-------|
| `getProjectById(id)` | `Project \| undefined` | Reads from cached `projects` |
| `getTasksByProjectId(projectId)` | `Task[]` | Excludes subtasks (`!parentTaskId`) |
| `getSubtasks(parentId)` | `Task[]` | Sorted by `order` |
| `getSectionsByProjectId(projectId)` | `Section[]` | Filters by `projectId` |
| `getUnlinkedSections()` | `Section[]` | Sections with `projectId === null` |

### Re-exports

`dataStore.ts` re-exports all singletons from `serviceContainer.ts` for convenience:

```typescript
export {
  localStorageBackend, projectRepository, taskRepository,
  sectionRepository, dependencyRepository, automationRuleRepository,
  taskService, projectService, sectionService, dependencyService,
  automationService,
} from '@/lib/serviceContainer';
```

### Backfill Migration

On module load, `backfillMovedToSectionAt()` runs once — sets `movedToSectionAt = task.updatedAt` for any task missing the field. Persists via `taskRepository.update()`.

## appStore — UI Preferences

Persisted UI state. No repository integration — pure Zustand `persist`.

### State Shape

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `settings.activeProjectId` | `UUID \| null` | `null` | Currently selected project |
| `settings.timeManagementSystem` | `TimeManagementSystem` | `NONE` | Active TMS strategy |
| `settings.showOnlyActionableTasks` | `boolean` | `false` | Filter to actionable tasks |
| `settings.theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Theme preference |
| `projectTabs` | `Record<UUID, string>` | `{}` | Per-project active tab |
| `globalTasksDisplayMode` | `'nested' \| 'flat'` | `'nested'` | Global tasks view mode |
| `columnOrder` | `TaskColumnId[]` | `['dueDate','priority','assignee','tags']` | Task table column order |
| `sortColumn` | `SortableColumnId \| null` | `null` | Active sort column |
| `sortDirection` | `'asc' \| 'desc'` | `'asc'` | Sort direction |
| `needsAttentionSort` | `boolean` | `false` | "Needs Attention" sort active |
| `autoHideThreshold` | `AutoHideThreshold` | `'24h'` | Completed task visibility policy |
| `showRecentlyCompleted` | `boolean` | `false` | Show recently completed within threshold |
| `keyboardShortcuts` | `Partial<ShortcutMap>` | `{}` | User overrides only (merged with defaults at read) |
| `activeView` | `'project' \| 'global-automations'` | `'project'` | Top-level nav view |
| `highlightRuleId` | `string \| null` | `null` | Rule to scroll-to in global panel |
| `globalPanelCompact` | `boolean` | `false` | Compact mode for global automations |

### Key Behaviors

- `toggleSort(column)`: Cycles asc → desc → clear. Disables `needsAttentionSort`.
- `setNeedsAttentionSort(true)`: Clears column sort.
- `setAutoHideThreshold('always'|'show-all')`: Resets `showRecentlyCompleted` to false.
- `setKeyboardShortcut(action, key)`: Stores override merged with defaults from `getDefaultShortcutMap()`.
- `resetKeyboardShortcuts()`: Clears all overrides (reverts to defaults).

### Exported Types

```typescript
export type TaskColumnId = 'dueDate' | 'priority' | 'assignee' | 'tags' | 'project';
export type SortableColumnId = 'name' | TaskColumnId | 'lastAction';
export type SortDirection = 'asc' | 'desc';
export const DEFAULT_COLUMN_ORDER: TaskColumnId[] = ['dueDate', 'priority', 'assignee', 'tags'];
```

## Feature-Level Stores

### tmsStore — Time Management Strategy State

Persisted (`task-management-tms`). Holds metadata for all 3 TMS strategies simultaneously — only the `activeSystem` determines which is used.

| Sub-state | Fields | Purpose |
|-----------|--------|---------|
| `dit` | `todayTasks[]`, `tomorrowTasks[]`, `lastDayChange` | Do It Tomorrow scheduling |
| `af4` | `markedTasks[]`, `markedOrder[]` | Autofocus 4 mark tracking |
| `fvp` | `dottedTasks[]`, `currentX`, `selectionInProgress` | FVP pairwise comparison |

Actions: `setActiveSystem`, DIT (`addToToday/Tomorrow`, `moveToToday/Tomorrow`, `removeFromSchedule`, `performDayRollover`), AF4 (`markTask`, `unmarkTask`), FVP (`startFVPSelection`, `selectFVPTask`, `skipFVPTask`, `endFVPSelection`, `resetFVP`), generic `updateState(delta)`, `clearSystemMetadata`.

### filterStore — Search & Filter (Transient)

Not persisted. Resets on page reload.

| Field | Type | Default |
|-------|------|---------|
| `searchQuery` | `string` | `''` |
| `priorityFilter` | `Priority \| null` | `null` |
| `dateRangeFilter` | `{ start: Date \| null; end: Date \| null }` | `{ start: null, end: null }` |
| `completionFilter` | `'all' \| 'completed' \| 'incomplete'` | `'all'` |

Actions: `setSearchQuery`, `setPriorityFilter`, `setDateRangeFilter`, `setCompletionFilter`, `clearFilters`.

### keyboardNavStore — Grid Navigation (Transient)

Not persisted. Lightweight state for keyboard grid navigation.

| Field | Type | Default |
|-------|------|---------|
| `focusedTaskId` | `string \| null` | `null` |
| `activeCell` | `GridCoord \| null` | `null` |

Single action: `setFocusedTask(taskId, cell)`.

## Write Path Architecture

The write path is the most critical flow. Understanding it prevents subtle bugs.

```
Component calls dataStore.updateTask(id, updates)
  → captures previousValues from repo.findById()
  → repo.update(id, { ...updates, updatedAt: now })
    → LocalStorageBackend.setEntities('tasks', newArray)
      → writes to unified key (task-management-app-state)
      → writes to 3 Zustand persist keys (backward compat)
      → notifies backend listeners
    → repo subscription fires
      → useDataStore.setState({ tasks: newTasks })  ← React re-renders
  → emitDomainEvent({ type: 'task.updated', ... })
    → automationService.handleEvent()
      → evaluateRules() → ruleExecutor.executeActions()
        → may cascade (up to depth 5, dedup by ruleId:entityId:actionType)
```

Critical: Every domain event emission MUST be wrapped in `automationService.beginBatch()` / `endBatch()` for aggregated toast notifications.

## Read Path Architecture

```
App loads → LocalStorageBackend constructor
  → try unified key → AppStateSchema.safeParse()
  → fallback: assemble from 3 Zustand persist keys
  → if all fail → empty default state
→ Repositories read from backend in-memory state
→ dataStore subscriptions fire → Zustand state populated
→ Components read via selectors: useDataStore(s => s.tasks)
```

## Persistence Strategy

### localStorage Keys

| Key | Owner | Contents |
|-----|-------|----------|
| `task-management-app-state` | `LocalStorageBackend` (unified) | Full `AppState` — Zod-validated on load |
| `task-management-data` | Zustand persist (dataStore) | `{ projects, tasks, sections, dependencies }` |
| `task-management-settings` | Zustand persist (appStore) | `{ settings, projectTabs }` |
| `task-management-tms` | Zustand persist (tmsStore) | `{ state: { activeSystem, dit, af4, fvp } }` |
| `task-management-automations` | `LocalStorageAutomationRuleRepository` | Automation rules (independent) |

Critical: `LocalStorageBackend.reset()` does NOT clear automation rules — they use an independent key. Import/export must handle rules separately.

### Dual-Write Pattern

`LocalStorageBackend.save()` writes to BOTH the unified key AND the 3 Zustand persist keys on every mutation. This ensures:
1. Unified key is the source of truth (Zod-validated on load)
2. Zustand persist keys stay in sync for backward compatibility
3. If unified key is corrupted, fallback assembly from Zustand keys works

Critical: Both Zustand `persist` middleware and `LocalStorageBackend` write to the same keys. Backend is authoritative — Zustand stores are caches synced via repository subscriptions.

## Subscription Wiring

Subscriptions are set up at module level in `dataStore.ts` (runs once on app load):

```typescript
// Repository → Zustand state sync
projectRepository.subscribe((projects) => useDataStore.setState({ projects }));
taskRepository.subscribe((tasks) => useDataStore.setState({ tasks }));
sectionRepository.subscribe((sections) => useDataStore.setState({ sections }));
dependencyRepository.subscribe((deps) => useDataStore.setState({ dependencies: deps }));
automationRuleRepository.subscribe((rules) => useDataStore.setState({ automationRules: rules }));

// Domain events → Automation engine
unsubscribeAll();  // Guard against HMR accumulation
subscribeToDomainEvents((event) => automationService.handleEvent(event));
```

## Testing

### Selector Usage (Correct)
```typescript
// Good — subscribes only to tasks slice
const tasks = useDataStore(s => s.tasks);

// Bad — subscribes to entire store, re-renders on any change
const store = useDataStore();
```

### Common Test Patterns
```typescript
// Reset state between tests
localStorageBackend.reset();
useDataStore.setState({ projects: [], tasks: [], sections: [], dependencies: [], automationRules: [] });

// Mock repository for unit tests
const mockRepo = { findById: vi.fn(), findAll: vi.fn(), ... };
```

### Regression Scenarios
1. Verify `backfillMovedToSectionAt` doesn't overwrite existing values
2. Verify `beginBatch/endBatch` wraps all domain event emissions
3. Verify `toggleSectionCollapsed` does NOT emit domain events
4. Verify `deleteProject` cascade order: rules → tasks → subtasks → deps → sections → project
5. Verify `updateTask` with `sectionId` change sets `movedToSectionAt`

## Tuning Constants

```
PersistVersion:          1 — Zustand persist version for all 3 persisted stores
UnifiedStorageKey:       'task-management-app-state' — Zod-validated source of truth
BackfillField:           movedToSectionAt — auto-set to updatedAt on first load if missing
CascadeMaxDepth:         5 — automation cascade limit (enforced in ruleExecutor)
DefaultColumnOrder:      ['dueDate', 'priority', 'assignee', 'tags'] — task table columns
DefaultAutoHideThreshold: '24h' — completed task visibility window
```

## Key Files

| File | Description |
|------|-------------|
| `stores/dataStore.ts` | Entity cache, CRUD actions, repo subscriptions, domain event wiring |
| `stores/appStore.ts` | UI preferences, sort, columns, keyboard shortcut overrides |
| `features/tms/stores/tmsStore.ts` | TMS strategy metadata (DIT/AF4/FVP) |
| `features/tasks/stores/filterStore.ts` | Transient search/filter state |
| `features/keyboard/stores/keyboardNavStore.ts` | Transient grid navigation state |
| `lib/serviceContainer.ts` | Composition root — all repos/services wired here |
| `lib/repositories/localStorageBackend.ts` | Unified persistence, Zod validation, dual-write |
| `lib/repositories/localStorageRepositories.ts` | Repository implementations with subscribe() |
| `lib/repositories/types.ts` | Repository interface definitions |
| `lib/events/domainEvents.ts` | Domain event pub/sub (emit, subscribe, unsubscribeAll) |
| `lib/events/types.ts` | DomainEvent interface definition |
| `lib/schemas.ts` | Zod schemas — AppStateSchema validates on load |

## References

### Source Files
- `stores/dataStore.ts` — entity cache + CRUD + subscription wiring
- `stores/appStore.ts` — UI preferences + sort/column/shortcut state
- `features/tms/stores/tmsStore.ts` — TMS strategy metadata
- `features/tasks/stores/filterStore.ts` — transient search/filter
- `features/keyboard/stores/keyboardNavStore.ts` — transient grid nav
- `lib/serviceContainer.ts` — composition root
- `lib/repositories/localStorageBackend.ts` — unified persistence layer
- `lib/schemas.ts` — Zod schemas (AppStateSchema)

### Related Context Docs
- [core-infrastructure.md](core-infrastructure.md) — Repository pattern, LocalStorageBackend, domain events consumed by stores
- [automations.md](automations.md) — AutomationService subscribes to domain events emitted by dataStore; automationRules synced via repo subscription
- [tms.md](tms.md) — TMS handler interface, strategy details, lifecycle integration, components
- [ui-shared.md](ui-shared.md) — ThemeProvider reads appStore.settings.theme; Layout uses useCrossTabSync for store rehydration
- [keyboard.md](keyboard.md) — Keyboard navigation; appStore persists shortcut overrides via `keyboardShortcuts`
