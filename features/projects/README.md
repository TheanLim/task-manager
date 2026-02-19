# Projects Feature

## Quick Reference

| Module | Path | Responsibility |
|---|---|---|
| `ProjectService` | `services/projectService.ts` | Entity factory (`create`), create with default sections, cascade-delete projects |
| `SectionService` | `services/sectionService.ts` | Cascade-delete sections (reassign tasks, detect broken rules) |
| `ProjectView` | `components/ProjectView.tsx` | Top-level project page — tabs, header, task views |
| `SectionManager` | `components/SectionManager.tsx` | CRUD UI for sections within project overview |
| `ProjectDialog` | `components/ProjectDialog.tsx` | Create/edit project dialog |
| `ProjectList` | `components/ProjectList.tsx` | Sidebar project listing |
| `ProjectTabs` | `components/ProjectTabs.tsx` | Tab bar (Overview, List, Board, Calendar, Automations) |
| `ProjectOverview` | `components/ProjectOverview.tsx` | Project details + settings |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│ ProjectView │────▶│  DataStore   │────▶│ ProjectRepository│
│ (component) │     │  (Zustand)   │     │ SectionRepository│
└─────────────┘     └──────────────┘     │ TaskRepository   │
                                         └──────────────────┘
                           ▲
                           │ business logic
                    ┌──────┴───────┐
                    │              │
             ┌──────────┐  ┌─────────────┐
             │ Project   │  │ Section     │
             │ Service   │  │ Service     │
             └──────────┘  └─────────────┘
                    │              │
                    ▼              ▼
             TaskService    brokenRuleDetector
```

- **Services** own all business logic (cascade deletes, default creation). They receive repositories via constructor injection — no direct store imports.
- **Components** read/write through `useDataStore` (Zustand). The store is a UI-state cache backed by per-entity repositories.
- **Cross-feature dependencies**: `ProjectService` delegates task deletion to `TaskService` (from `features/tasks`). `SectionService` calls `detectBrokenRules` (from `features/automations`).

## Key Flows

**Create project** → `ProjectService.createWithDefaults(project)` → inserts project + 3 default sections ("To Do", "Doing", "Done").

**Delete project** → `ProjectService.cascadeDelete(projectId)` → automation rules → top-level tasks (via `TaskService.cascadeDelete`) → sections → project.

**Delete section** → `SectionService.cascadeDelete(sectionId)` → reassign tasks to "To Do" section → delete section → detect/disable broken automation rules.
