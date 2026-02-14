# Implementation Plan: Architecture Refactor

## Overview

Incremental refactoring of the task management app from monolithic stores to a layered architecture (Zod schemas → repositories → services → store rewiring → page decomposition → TMS decoupling → TMS disconnection → directory restructuring). Each phase is independently testable and behavior-preserving.

## Tasks

- [x] 1. Add Zod dependency and create schemas
  - [x] 1.1 Install Zod and create `lib/schemas.ts` with Zod schemas for all domain types (Project, Task, Section, TaskDependency, TMSState, AppSettings, AppState)
    - Derive TypeScript types via `z.infer<>` and re-export them
    - Note: Section IDs use `z.string()` (not uuid) because current code generates IDs like `${projectId}-section-todo`
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Replace hand-rolled validation in `lib/storage.ts` with Zod schema parsing
    - Replace `validateState`, `validateProjects`, `validateTasks`, `validateSections`, `validateDependencies`, `validateTMSState`, `validateSettings` methods with `AppStateSchema.safeParse()`
    - On load failure: return null and log error
    - On import failure: throw ImportError with Zod error message
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.3 Update `types/index.ts` to re-export types from `lib/schemas.ts` for backward compatibility
    - Keep existing enum definitions (Priority, ViewMode, TimeManagementSystem) since Zod uses string enums
    - Re-export Zod-inferred types as the canonical types
    - _Requirements: 1.5_

  - [x] 1.4 Write property tests for Zod schema validation
    - **Property 1: Zod validation rejects invalid data on load**
    - **Property 2: Zod validation rejects invalid data on import**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 1.5 Migrate existing `lib/storage.test.ts` to work with Zod-based validation
    - Update test assertions if error messages changed
    - Ensure all existing storage tests still pass
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create repository interfaces and localStorage implementations
  - [x] 3.1 Create `lib/repositories/types.ts` with generic Repository interface and entity-specific repository interfaces (TaskRepository, ProjectRepository, SectionRepository, DependencyRepository)
    - Include subscribe method signature returning Unsubscribe function
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Create `lib/repositories/localStorageBackend.ts` — shared backend that manages the full AppState blob in localStorage
    - Reads/writes the full blob, validates with Zod on load
    - Provides `getEntities(key)`, `setEntities(key, value)`, `onEntityChange(key, callback)` methods
    - Maintains backward compatibility with existing localStorage keys (`task-management-data`, `task-management-tms`, `task-management-settings`)
    - _Requirements: 2.5, 2.7, 2.8_

  - [x] 3.3 Create localStorage repository implementations (`LocalStorageTaskRepository`, `LocalStorageProjectRepository`, `LocalStorageSectionRepository`, `LocalStorageDependencyRepository`)
    - Each delegates to the shared LocalStorageBackend
    - Each implements entity-specific query methods (findByProjectId, findByParentTaskId, etc.)
    - _Requirements: 2.5, 2.6_

  - [x] 3.4 Write property tests for repository implementations
    - **Property 3: Repository create-read round-trip**
    - **Property 4: Repository subscriber notification**
    - **Validates: Requirements 2.5, 2.6, 2.7, 2.8**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create service layer
  - [x] 5.1 Create `lib/services/taskService.ts` with TaskService class
    - Constructor receives TaskRepository and DependencyRepository
    - Implement cascadeDelete: recursively find subtasks via findByParentTaskId, delete all, delete associated dependencies
    - Implement cascadeComplete: update task completion, optionally cascade to subtasks
    - _Requirements: 3.1, 3.4_

  - [x] 5.2 Create `lib/services/projectService.ts` with ProjectService class
    - Constructor receives ProjectRepository, SectionRepository, and TaskService
    - Implement createWithDefaults: create project + 3 default sections (To Do, Doing, Done)
    - Implement cascadeDelete: delete all project tasks via TaskService, delete sections, delete project
    - _Requirements: 3.2, 3.5, 3.6_

  - [x] 5.3 Create `lib/services/dependencyService.ts` with DependencyService class
    - Constructor receives DependencyRepository and DependencyResolver
    - Implement addDependency: check circular dependency, then create
    - _Requirements: 3.3_

  - [x] 5.4 Write property tests for services
    - **Property 5: TaskService cascade delete removes all descendants**
    - **Property 6: ProjectService cascade delete removes all project entities**
    - **Property 7: ProjectService create produces default sections**
    - **Validates: Requirements 3.4, 3.5, 3.6**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Rewire dataStore to use repositories and services
  - [x] 7.1 Refactor `stores/dataStore.ts` to initialize repository instances and services
    - Create LocalStorageBackend, repository instances, and service instances
    - Subscribe to all repositories and cache entity arrays in store state
    - _Requirements: 4.1, 4.5_

  - [x] 7.2 Update dataStore mutation methods to delegate to services
    - `addProject` → `projectService.createWithDefaults`
    - `deleteProject` → `projectService.cascadeDelete`
    - `deleteTask` → `taskService.cascadeDelete`
    - Other mutations delegate to corresponding repository methods
    - Remove inline business logic (cascade delete, default section creation)
    - _Requirements: 4.2_

  - [x] 7.3 Migrate `stores/dataStore.test.ts` to test through the new service/repository layer
    - Update test setup to use repository-backed store
    - Existing behavioral assertions should still pass
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 7.4 Write property test for store-repository synchronization
    - **Property 8: Store-repository synchronization**
    - **Validates: Requirements 4.1, 4.5**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Decompose page.tsx
  - [x] 9.1 Extract `lib/hooks/useDialogManager.ts` — hook managing all dialog state (project dialog, task dialog, dependency dialog, shared state dialog, task detail panel)
    - Move dialog-related useState calls from HomeContent into this hook
    - Return state object and handler functions
    - _Requirements: 5.3_

  - [x] 9.2 Extract `lib/hooks/useSharedStateLoader.ts` — hook handling URL hash parsing and shared state import
    - Move the loadSharedState useEffect from HomeContent
    - _Requirements: 5.4_

  - [x] 9.3 Extract `components/ProjectView.tsx` — container for project-specific rendering
    - Receives projectId, handles tab routing (overview, list, board, calendar)
    - Contains task CRUD callbacks and view mode rendering
    - _Requirements: 5.1_

  - [x] 9.4 Extract `components/GlobalTasksContainer.tsx` — container for global tasks view
    - Wraps GlobalTasksHeader + GlobalTasksView
    - Handles display mode toggle
    - _Requirements: 5.2_

  - [x] 9.5 Slim down `app/page.tsx` to a thin router
    - Use URL params to route between ProjectView, GlobalTasksContainer, and landing view
    - Wire in useDialogManager and useSharedStateLoader hooks
    - _Requirements: 5.5_

  - [x] 9.6 Update existing page-level tests (`app/page.completion-cascade.test.tsx`) to work with decomposed components
    - Adjust imports and test setup as needed
    - _Requirements: 5.1, 5.2, 5.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Decouple TMS handlers
  - [x] 11.1 Refactor TMS handlers (`DITHandler.ts`, `AF4Handler.ts`, `FVPHandler.ts`, `StandardHandler.ts`) to pure functions
    - Change from classes that import stores to exported functions that accept state parameters and return state deltas
    - `getOrderedTasks(tasks, tmsState) → Task[]`
    - `onTaskCompleted(task, tmsState) → Partial<TMSState>`
    - `onTaskCreated(task, tmsState) → Partial<TMSState>`
    - `initialize(tasks, tmsState) → Partial<TMSState>`
    - Update `lib/tms/index.ts` factory to return handler objects with these pure functions
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 11.2 Update all TMS handler call sites to read state from store, pass to handler, and apply returned update
    - Update components (DITView, AF4View, FVPView) and any page-level code that calls TMS handlers
    - _Requirements: 6.5_

  - [x] 11.3 Migrate existing TMS handler tests (`lib/tms/*.test.ts`) to test pure functions
    - Remove store mocking, pass state directly as arguments
    - Existing assertions should still hold
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 11.4 Write property tests for TMS handlers
    - **Property 9: TMS getOrderedTasks returns a permutation**
    - **Property 10: TMS task lifecycle handlers return valid state**
    - **Property 11: TMS initialize returns valid state**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Disconnect TMS from project views
  - [x] 13.1 Update `app/page.tsx` (or `ProjectView.tsx`) to always render ProjectTabs when a project is active
    - Remove any conditional rendering based on `settings.timeManagementSystem`
    - Remove commented-out TMS selector rendering
    - Keep TMS components and handlers as standalone modules
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Restructure to feature-based directories
  - [x] 15.1 Create feature directory structure and move task-related files to `features/tasks/`
    - Move: TaskService, TaskRepository implementations, TaskList, TaskRow, TaskBoard, TaskCalendar, TaskDialog, TaskDetailPanel, DependencyDialog, DependencyList, useFilteredTasks, and their tests
    - _Requirements: 8.1_

  - [x] 15.2 Move project-related files to `features/projects/`
    - Move: ProjectService, ProjectRepository implementations, ProjectList, ProjectDialog, ProjectOverview, ProjectTabs, SectionManager, and their tests
    - _Requirements: 8.2_

  - [x] 15.3 Move TMS-related files to `features/tms/`
    - Move: TMS handlers, DITView, AF4View, FVPView, TMSSelector, tmsStore, and their tests
    - _Requirements: 8.3_

  - [x] 15.4 Move sharing-related files to `features/sharing/`
    - Move: ShareService, ShareButton, SharedStateDialog, and their tests
    - _Requirements: 8.4_

  - [x] 15.5 Update all import paths across the codebase
    - Update imports in all moved files and their consumers
    - Verify shared infrastructure stays in `lib/` and `components/ui/` stays unchanged
    - _Requirements: 8.5, 8.6, 8.7_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each phase is independently testable — run `vitest run` after each checkpoint
- The app is statically hosted on GitHub Pages, so all persistence remains client-side localStorage
- Existing tests are migrated incrementally (tasks 1.5, 7.3, 9.6, 11.3) to ensure no regressions
- Property tests use fast-check (already in devDependencies) with minimum 100 iterations
- Directory restructuring (phase 15) is intentionally last to minimize merge conflicts during logic changes
