# Project Feature — Key Decisions

## 1. Default Sections on Project Creation

`ProjectService.createWithDefaults` creates three sections automatically:

| Section | ID Format | Order |
|---|---|---|
| To Do | `{projectId}-section-todo` | 0 |
| Doing | `{projectId}-section-doing` | 1 |
| Done | `{projectId}-section-done` | 2 |

**Rationale**: Every project needs a minimal kanban structure out of the box. The deterministic ID format (`{projectId}-section-*`) avoids UUID generation for seed/default data and makes IDs predictable for tests and automation rules.

## 2. Non-UUID Section IDs

Default section IDs use the pattern `{projectId}-section-todo` rather than UUIDs. User-created sections (via `SectionManager`) use `uuidv4()`. Zod schemas validate IDs as `z.string().min(1)` — not `.uuid()` — to accommodate both formats.

**Rationale**: Deterministic IDs simplify debugging, test assertions, and cross-entity references. The relaxed schema avoids silent validation failures that previously caused data loss (see MEMORY.md `2026-02-16` entry).

## 3. Cascade Delete Order — Project

`ProjectService.cascadeDelete` follows a strict order:

1. **Automation rules** — delete all rules for the project (no orphan rules firing post-delete)
2. **Top-level tasks** — via `TaskService.cascadeDelete`, which handles subtasks and dependency cleanup
3. **Sections** — remove all project sections
4. **Project** — remove the project entity itself

**Rationale**: Rules reference sections and tasks, so they must go first. `TaskService` owns subtask/dependency graph teardown, so only top-level tasks are passed to it — it recurses internally. Sections are deleted after tasks to avoid dangling `sectionId` references during task cleanup.

## 4. Cascade Delete — Section (Task Reassignment)

`SectionService.cascadeDelete` does not delete tasks. Instead:

1. Reassign all tasks in the deleted section to the project's "To Do" section
2. Delete the section
3. Call `detectBrokenRules` to find and disable automation rules that referenced the deleted section

**Rationale**: Deleting a section shouldn't destroy work. Moving tasks to "To Do" is the safest default — users can re-triage from there. Broken-rule detection (Req 2.1, 2.2) ensures automations don't silently reference a nonexistent section.

## 5. Service ↔ Repository Boundary

Services receive repositories via constructor injection. Components never call services directly — they go through `useDataStore` (Zustand). Services are invoked by the store's action methods or by other services.

**Rationale**: Keeps business logic testable without UI framework dependencies. Repositories are mockable via simple `Map<string, T>` implementations in tests.

## 6. Sidebar visual enhancements (task counts, progress bars)

**Decision**: ProjectList derives task counts and completion progress from `useDataStore().tasks` via `useMemo`. Renders Badge + progress bar per project.

**Why**: Provides at-a-glance project health without navigating into each project. The computation is memoized on `tasks` array reference to avoid re-computing on unrelated state changes.

**Active project styling**: Changed from `bg-accent/50` to `bg-accent-brand/5` to align with the brand accent color system.
