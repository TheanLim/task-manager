---
name: tasks
description: Tasks and Projects feature conventions
inclusion: fileMatch
fileMatchPattern: "features/tasks/**/*,features/projects/**/*"
---

# Tasks & Projects

## ProjectView

Entry point for a single project. Renders a sticky header (project name inline-editable, Share button, New Task button) and a tabbed content area.

Tabs: `overview`, `list`, `board`, `calendar`, `automations`

- Tab state is synced between URL (`?tab=`) and `appStore.projectTabs` (per-project memory)
- `filteredTasks` comes from `useFilteredTasks` — respects auto-hide threshold and actionable filter
- `projectSections` from `getSectionsByProjectId` — passed to TaskList, TaskBoard, AutomationTab
- Section context menu → RuleDialog wired via `handleOpenRuleDialogFromSection` / `sectionPrefillTrigger`
- Automation rule badge count is reactive via `automationRuleRepository.subscribe()`
- New Task button lives in the project header (right of Share), not in the global header

## TaskList

Table-based list view. Key props:

| Prop | Purpose |
|------|---------|
| `sections` | Ordered sections; drives grouping and drag-reorder |
| `readonlySectionIds` | Set of section IDs that render as plain text with no controls |
| `flatMode` | Flattens subtasks into the same level as parent tasks |
| `showProjectColumn` | Adds a project name column (used in global tasks view) |
| `onOpenRuleDialog` | Wires section context menu → automation rule creation |

Add Section button appears below the table only when `sections[0]?.projectId` is set (project view, not global view). It auto-cancels on blur.

## TaskBoard

Kanban view using `@dnd-kit`. Sections are horizontal columns; tasks are vertically sortable within columns. Add Section button is at the end of the column row.

## Section Management

- `SectionService.createWithDefaults(name, projectId, order)` — always use this, never construct inline
- `SectionService.cascadeDelete(id)` — moves tasks to first section, checks for broken automation rules
- Section IDs are non-UUID strings (e.g. seed data uses `${projectId}-section-todo`) — never use `.uuid()` in schemas

## Key Conventions

- Entity construction (sections, tasks) always goes through the service layer
- `onAddTask(sectionId)` bubbles up to `onNewTask` in `ProjectView` / `page.tsx`
- `useFilteredTasks` must wrap task arrays before passing to list/board/calendar

## ProjectList

Sidebar navigation component. Renders an "All Tasks" link and the project list with task counts and progress bars.

| Prop | Purpose |
|------|---------|
| `projects` | Ordered project array |
| `activeProjectId` | Currently selected project |
| `onProjectSelect` | Callback when a project is clicked |
| `onNewProject` | Callback for the "+" button |
| `onTasksClick` | Optional — called when "All Tasks" is clicked; use to reset top-level view state |

- URL routing: project click → `/?project={id}&tab=list`; All Tasks click → `/?view=tasks`
- Active state derived from URL `?view=tasks` for global tasks, `activeProjectId` for projects
- Task counts and completion progress computed per-project from `dataStore.tasks`
