# Requirements Document: Subtask Creation

## Introduction

This feature enables users to create subtasks from the Task Detail Panel. The infrastructure for subtasks already exists (parentTaskId field, recursive rendering, getSubtasks method), but users currently cannot create new subtasks. This feature will complete the subtask functionality by implementing the creation workflow.

## Glossary

- **Task**: A work item in the task management system with properties like description, priority, and due date
- **Subtask**: A Task with a non-null parentTaskId field, representing a child task of another task
- **Parent_Task**: A Task that has one or more subtasks (tasks with parentTaskId pointing to it)
- **Task_Detail_Panel**: The UI component that displays full task details with inline editing capabilities
- **Task_Dialog**: The modal dialog component used for creating and editing tasks
- **Data_Store**: The Zustand store managing application state including tasks, projects, and sections

## Requirements

### Requirement 1: Subtask Creation from Task Detail Panel

**User Story:** As a user, I want to create subtasks from the Task Detail Panel, so that I can break down complex tasks into smaller, manageable pieces.

#### Acceptance Criteria

1. WHEN a user clicks the "Add Subtask" button in the Task Detail Panel, THE System SHALL open the Task Dialog
2. WHEN the Task Dialog opens for subtask creation, THE System SHALL pre-populate the projectId and sectionId from the parent task
3. WHEN a user submits the Task Dialog for subtask creation, THE System SHALL create a new task with parentTaskId set to the parent task's ID
4. WHEN a subtask is created, THE System SHALL assign it an order value based on the count of existing subtasks for that parent
5. WHEN a subtask is created, THE System SHALL display it in the subtasks list of the Task Detail Panel

### Requirement 2: Property Inheritance

**User Story:** As a user, I want subtasks to inherit properties from their parent, so that subtasks are automatically configured with relevant context.

#### Acceptance Criteria

1. WHEN a subtask is created, THE System SHALL set its projectId to match the parent task's projectId
2. WHEN a subtask is created, THE System SHALL set its sectionId to match the parent task's sectionId
3. WHEN a subtask is created, THE System SHALL set its priority to match the parent task's priority
4. WHEN a subtask is created, THE System SHALL set its tags to match the parent task's tags
5. WHEN a subtask is created, THE System SHALL set its assignee to match the parent task's assignee
6. WHEN a subtask is created, THE System SHALL allow the user to modify inherited properties in the Task Dialog

### Requirement 3: Single-Level Nesting Only

**User Story:** As a user, I want to create subtasks only for top-level tasks, so that the task hierarchy remains simple and manageable.

#### Acceptance Criteria

1. WHEN viewing a task with parentTaskId equal to null in the Task Detail Panel, THE System SHALL display an "Add Subtask" button
2. WHEN viewing a task with parentTaskId not equal to null in the Task Detail Panel, THE System SHALL NOT display an "Add Subtask" button
3. WHEN a subtask is created, THE System SHALL set its parentTaskId to the parent task's ID
4. THE System SHALL prevent creation of subtasks for tasks that already have a parent

### Requirement 4: State Management

**User Story:** As a developer, I want proper state management for subtask creation, so that the UI remains consistent and predictable.

#### Acceptance Criteria

1. WHEN the Task Dialog is opened for subtask creation, THE System SHALL track the parent task ID in component state
2. WHEN the Task Dialog is closed or submitted, THE System SHALL reset the parent task ID state to null
3. WHEN a subtask is created, THE System SHALL update the Data Store with the new task
4. WHEN the Task Detail Panel displays subtasks, THE System SHALL query the Data Store using the getSubtasks method

### Requirement 5: Parent Completion Cascades to Subtasks

**User Story:** As a user, I want all subtasks to be automatically completed when I complete the parent task, so that I don't have to manually complete each subtask.

#### Acceptance Criteria

1. WHEN a parent task is marked as completed, THE System SHALL mark all its subtasks as completed
2. WHEN a parent task is marked as completed, THE System SHALL set the completedAt timestamp for all subtasks
3. WHEN a parent task is marked as incomplete, THE System SHALL mark all its subtasks as incomplete
4. WHEN a parent task is marked as incomplete, THE System SHALL set the completedAt timestamp to null for all subtasks

### Requirement 6: UI Consistency

**User Story:** As a user, I want the subtask creation experience to be consistent with regular task creation, so that I don't need to learn a new workflow.

#### Acceptance Criteria

1. WHEN creating a subtask, THE System SHALL use the same Task Dialog component as regular task creation
2. WHEN the Task Dialog opens for subtask creation, THE System SHALL pre-populate fields with inherited values from the parent
3. WHEN a user cancels subtask creation, THE System SHALL close the Task Dialog without creating a task
4. WHEN a subtask is successfully created, THE System SHALL close the Task Dialog and refresh the subtasks list
