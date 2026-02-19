# Architecture Decisions — features/tasks/

## 1. Sorting logic extracted to taskSortService

**Decision**: `sortTasks()` and `sortByLastAction()` live in `services/taskSortService.ts` as pure functions. `TaskList.tsx` delegates to them.

**Why**: TaskList.tsx was 1068 lines with sorting logic (priority weights, null-handling for each column, direction toggling) tangled into the component. Extracting to a service makes the logic independently testable and reduces the component to rendering concerns.

**API**: `sortTasks(tasks, column, direction, getProjectName)` — the `getProjectName` callback avoids coupling the service to the store. Returns a new array; does not mutate input.

## 2. SectionService.createWithDefaults centralizes section construction

**Decision**: Section entity construction (ID generation, timestamps, defaults) lives in `SectionService.createWithDefaults()`. Components call the service instead of constructing inline.

**Why**: Architecture rule #5 — no inline entity construction in components. Three components (TaskList, TaskBoard, SectionManager) had identical `{ id: uuidv4(), createdAt: new Date().toISOString(), ... }` blocks. Centralizing ensures consistent defaults and makes the construction testable.

**Call sites updated**: `TaskList.handleAddSection`, `TaskBoard.handleAddSection`, `SectionManager.handleAddSection`.

## 3. TaskService emitEvent wired in serviceContainer

**Decision**: `serviceContainer.ts` passes `emitDomainEvent` to the `TaskService` constructor.

**Why**: `TaskService` accepted an optional `emitEvent` callback but the production wiring in `serviceContainer.ts` never passed it. This meant `cascadeDelete` and `cascadeComplete` silently skipped domain event emission, breaking automation rule cascading for these operations.

**Impact**: Automation rules now fire correctly when tasks are cascade-deleted or cascade-completed via `TaskService`. Test call sites intentionally omit the callback where event emission isn't under test.

## 4. dependencyResolver moved to services/

**Decision**: `dependencyResolver.ts` (interface + `DependencyResolverImpl` class) moved from the feature root to `services/dependencyResolver.ts`.

**Why**: It's service-layer logic — an interface and implementation class. Every other service-layer file in tasks lives in `services/`. Having it at the feature root broke the convention and required special coverage globs.

## 5. GlobalTasks components moved from top-level components/

**Decision**: `GlobalTasksView.tsx`, `GlobalTasksHeader.tsx`, `GlobalTasksContainer.tsx` moved from `components/` to `features/tasks/components/`.

**Why**: These components are tightly coupled to tasks internals — they import `TaskList`, `autoHideService`, `taskService`, and `useAppStore` global-tasks settings. They're not shared UI primitives; they're task-feature views. A new developer would never look in `components/` for them.

## 6. filterStore co-located with tasks

**Decision**: `filterStore.ts` moved from `stores/` to `features/tasks/stores/`.

**Why**: Its only consumers are task-filtering components and hooks (`useFilteredTasks`, `FilterPanel`, `SearchBar`). It doesn't serve other features.

## 7. Shared UI extractions: DatePickerPopover, TagEditorPopover, getPriorityVariant

**Decision**: Extracted three duplicated patterns into shared components/utilities within `features/tasks/`.

**What was extracted**:
- `DatePickerPopover` — Popover with CalendarComponent + "Clear date" button. Was duplicated 5 times across TaskDetailPanel (2), TaskRow (1), TaskBoard (2).
- `TagEditorPopover` — Popover with tag input, add/remove, badge list. Was duplicated in TaskDetailPanel and TaskRow.
- `getPriorityVariant()` — Priority enum → Badge variant mapping. Was duplicated in TaskDetailPanel and TaskRow.

**Why**: Code review identified these as the top 3 highest-ROI refactoring targets. Each extraction eliminates shotgun surgery risk — changes to date picking, tag editing, or priority display now require touching one file instead of 3-5.

**Location**: Components stay in `features/tasks/components/` (not `components/`) because they depend on task-domain types and are only used within task views. `getPriorityVariant` is in `services/` as a pure function.
