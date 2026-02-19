# Tasks Feature

Core task management: CRUD, hierarchy (parent/subtask), dependencies, sorting, filtering, and multiple view modes.

## Quick Reference

| File / Dir | Purpose |
|---|---|
| `components/TaskList.tsx` | Table view — sections, drag-drop reorder, column sort/resize/reorder, keyboard nav |
| `components/TaskBoard.tsx` | Kanban board view — drag-drop between sections via @dnd-kit |
| `components/TaskRow.tsx` | Single task row with inline editing, subtask expansion, metadata |
| `components/TaskDetailPanel.tsx` | Side panel for editing task fields, notes, dependencies, subtasks |
| `components/TaskDialog.tsx` | Modal for creating/editing tasks |
| `components/TaskCalendar.tsx` | Calendar view showing tasks by due date |
| `components/DependencyDialog.tsx` | Dialog for managing task dependencies |
| `components/DependencyList.tsx` | Renders blocking/blocked dependency lists |
| `components/GlobalTasksView.tsx` | All-tasks view — groups project tasks into virtual "From Projects" section |
| `components/GlobalTasksHeader.tsx` | Header with display mode toggle, review queue, completed-task controls |
| `components/GlobalTasksContainer.tsx` | Composes GlobalTasksHeader + GlobalTasksView |
| `components/RichTextEditor.tsx` | Quill-based rich text editor for task notes |
| `services/taskService.ts` | Business logic: cascade delete, cascade complete, reinsert |
| `services/taskSortService.ts` | Pure sorting functions for task lists (by column, by last action) |
| `services/autoHideService.ts` | Time-based auto-hide for completed tasks |
| `services/dependencyService.ts` | Dependency creation with circular dependency checks |
| `services/dependencyResolver.ts` | Pure functions: isTaskBlocked, getBlockingTasks, hasCircularDependency |
| `hooks/useFilteredTasks.ts` | Hook for filtering tasks by search, priority, tags |
| `stores/filterStore.ts` | Transient search/filter state (search query, priority, date range, completion) |
| `index.ts` | Barrel export — public API for external consumers |

## Key Design Decisions

See [DECISIONS.md](./DECISIONS.md) for rationale behind architectural choices.
