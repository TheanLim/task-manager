# Requirements Document

## Introduction

This document specifies the requirements for refactoring the Next.js task management application's architecture. The refactoring introduces Zod-based validation, a repository pattern for database swappability, a service layer for business logic, UI-only Zustand stores, page decomposition, decoupled TMS handlers, and a feature-based directory structure. The goal is improved extensibility, testability, and maintainability without changing user-facing behavior.

## Glossary

- **App**: The Next.js task management application
- **Repository**: An interface providing per-entity CRUD operations and a subscribe method for reactivity
- **Service**: A module encapsulating business logic that operates through Repository interfaces
- **Store**: A Zustand state container used exclusively for UI/client state and as a read-through cache for repository data
- **TMS_Handler**: A Time Management System handler that orders tasks and responds to lifecycle events (DIT, AF4, FVP)
- **Zod_Schema**: A Zod schema definition that serves as the single source of truth for both TypeScript types and runtime validation
- **StorageAdapter**: The current interface that operates on entire AppState blobs for persistence
- **LocalStorageAdapter**: The current localStorage-based implementation of StorageAdapter
- **Entity**: A domain object (Project, Task, Section, or TaskDependency) persisted by the App
- **DialogManager**: A hook or context responsible for coordinating dialog open/close state and parameters

## Requirements

### Requirement 1: Zod Schema Validation

**User Story:** As a developer, I want domain types validated by Zod schemas, so that I have a single source of truth for TypeScript types and runtime validation.

#### Acceptance Criteria

1. THE App SHALL define Zod schemas for Project, Task, Section, TaskDependency, TMSState, AppSettings, and AppState entities
2. WHEN the App validates persisted data, THE App SHALL use Zod schemas instead of hand-rolled validation logic
3. WHEN Zod schema validation fails on load, THE App SHALL return null and log the validation error
4. WHEN Zod schema validation fails on import, THE App SHALL throw an ImportError with a descriptive message
5. THE App SHALL derive TypeScript types from Zod schemas using z.infer so that type definitions and validation remain synchronized

### Requirement 2: Repository Pattern

**User Story:** As a developer, I want per-entity repository interfaces with granular CRUD methods, so that I can swap the storage backend without changing business logic.

#### Acceptance Criteria

1. THE App SHALL define a TaskRepository interface with findById, findByProjectId, findByParentTaskId, create, update, delete, findAll, and subscribe methods
2. THE App SHALL define a ProjectRepository interface with findById, create, update, delete, findAll, and subscribe methods
3. THE App SHALL define a SectionRepository interface with findById, findByProjectId, create, update, delete, findAll, and subscribe methods
4. THE App SHALL define a DependencyRepository interface with findById, findByBlockingTaskId, findByBlockedTaskId, create, delete, findAll, and subscribe methods
5. THE App SHALL provide a LocalStorage implementation for each Repository interface that reads from and writes to the existing localStorage blob
6. WHEN a Repository subscribe callback is registered, THE Repository SHALL invoke the callback after every mutation to that entity type
7. THE App SHALL serialize Repository state to JSON for localStorage persistence
8. THE App SHALL deserialize Repository state from JSON on load using Zod schemas for validation

### Requirement 3: Service Layer

**User Story:** As a developer, I want business logic extracted into service modules that operate through repositories, so that logic is testable independently of UI state.

#### Acceptance Criteria

1. THE App SHALL provide a TaskService with methods for cascade-complete, cascade-delete, and subtask ordering that call TaskRepository and DependencyRepository
2. THE App SHALL provide a ProjectService with methods for create-with-default-sections and cascade-delete that call ProjectRepository, SectionRepository, and TaskService
3. THE App SHALL provide a DependencyService that wraps DependencyResolver with CRUD operations through DependencyRepository
4. WHEN TaskService cascade-deletes a task, THE TaskService SHALL delete all descendant subtasks and associated dependencies
5. WHEN ProjectService cascade-deletes a project, THE ProjectService SHALL delete all tasks, sections, and dependencies belonging to that project
6. WHEN ProjectService creates a project, THE ProjectService SHALL create three default sections (To Do, Doing, Done) for that project

### Requirement 4: UI-Only Stores

**User Story:** As a developer, I want Zustand stores to serve only as UI state containers and read-through caches, so that swapping the database does not require store changes.

#### Acceptance Criteria

1. THE dataStore SHALL subscribe to all Repository instances and cache the latest entity arrays for React consumption
2. THE dataStore SHALL delegate all mutation operations to the appropriate Service
3. THE tmsStore SHALL remain unchanged as client-only TMS state
4. THE filterStore SHALL remain unchanged as client-only filter state
5. WHEN a Repository notifies of a change, THE dataStore SHALL update its cached state to reflect the change

### Requirement 5: Page Decomposition

**User Story:** As a developer, I want page.tsx decomposed into focused container components, so that the main page is a thin router and each view is independently maintainable.

#### Acceptance Criteria

1. THE App SHALL extract a ProjectView container component that handles project-specific tab routing, task CRUD callbacks, and view mode rendering
2. THE App SHALL extract a GlobalTasksContainer component that handles the global tasks view with its header and display modes
3. THE App SHALL extract a DialogManager hook or context that manages all dialog open/close state and parameters (project dialog, task dialog, dependency dialog, shared state dialog, task detail panel)
4. THE App SHALL extract a SharedStateLoader component or hook that handles URL hash parsing and shared state import on mount
5. WHEN page.tsx renders, THE page component SHALL act as a thin router that delegates to ProjectView, GlobalTasksContainer, or a landing view based on URL parameters

### Requirement 6: TMS Handler Decoupling

**User Story:** As a developer, I want TMS handlers to be pure functions that receive state and return new state, so that handlers have no direct store dependencies.

#### Acceptance Criteria

1. THE TMS_Handler getOrderedTasks method SHALL accept tasks and TMS state as parameters and return an ordered task array without reading from any store
2. THE TMS_Handler onTaskCompleted method SHALL accept a task and TMS state as parameters and return a partial TMS state update without writing to any store
3. THE TMS_Handler onTaskCreated method SHALL accept a task and TMS state as parameters and return a partial TMS state update without writing to any store
4. THE TMS_Handler initialize method SHALL accept tasks and TMS state as parameters and return a partial TMS state update without reading from or writing to any store
5. WHEN a call site invokes a TMS_Handler method, THE call site SHALL read state from the store, pass it to the handler, and apply the returned update to the store

### Requirement 7: Disconnect TMS from Project Views

**User Story:** As a developer, I want TMS views disconnected from the main project and task views, so that the project view always renders ProjectTabs regardless of TMS settings.

#### Acceptance Criteria

1. WHEN a project is active, THE App SHALL render ProjectTabs without conditional branching based on the active TMS setting
2. THE App SHALL remove the commented-out TMS selector rendering from page.tsx
3. THE App SHALL keep TMS components (DITView, AF4View, FVPView, TMSSelector) and handlers as standalone modules available for future use

### Requirement 8: Feature-Based Directory Structure

**User Story:** As a developer, I want files organized by feature domain, so that related code is co-located and the codebase is navigable at scale.

#### Acceptance Criteria

1. THE App SHALL organize task-related files (TaskService, TaskRepository, task components, task hooks) under a features/tasks/ directory
2. THE App SHALL organize project-related files (ProjectService, ProjectRepository, project components) under a features/projects/ directory
3. THE App SHALL organize TMS-related files (TMS handlers, TMS components, TMS store) under a features/tms/ directory
4. THE App SHALL organize sharing-related files (ShareService, ShareButton, SharedStateDialog) under a features/sharing/ directory
5. THE App SHALL keep shared infrastructure (Zod schemas, base repository interfaces, validation utilities) at the top level under lib/
6. THE App SHALL keep shared UI primitives in the components/ui/ directory unchanged
7. WHEN files are relocated, THE App SHALL update all import paths so that existing functionality remains intact
