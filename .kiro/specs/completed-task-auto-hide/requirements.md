# Requirements Document

## Introduction

Auto-hide completed tasks from the All Tasks page after a configurable time threshold. Tasks are never deleted — this is a read-time filter applied during rendering. The feature must interact correctly with existing Review Queue mode, Hide Completed toggle, and Nested/Flat display modes.

## Glossary

- **Auto_Hide_Filter**: A read-time filter that excludes completed tasks from the All Tasks page based on elapsed time since completion.
- **Threshold**: The configurable duration after which a completed task is auto-hidden. Options: 24 hours, 48 hours, 1 week, or Never.
- **All_Tasks_Page**: The global tasks view that aggregates tasks from all projects and unlinked tasks.
- **Review_Queue_Mode**: An existing mode (`needsAttentionSort`) that hides all completed tasks and sorts by last reviewed time.
- **Hide_Completed_Toggle**: An existing toggle (`hideCompletedTasks`) that immediately hides all completed tasks regardless of completion time.
- **Nested_Mode**: Display mode where subtasks are rendered as children of their parent task.
- **Flat_Mode**: Display mode where all tasks (parents and subtasks) are rendered at the same level independently.
- **Recently_Completed_View**: A UI surface that displays tasks auto-hidden by the threshold, allowing users to reference completed work.

## Requirements

### Requirement 1: Auto-Hide Completed Parent Tasks

**User Story:** As a user, I want completed parent tasks to disappear from the All Tasks page after a time threshold, so that my task list stays focused on active work.

#### Acceptance Criteria

1. WHEN a parent task has been completed for longer than the configured Threshold, THE Auto_Hide_Filter SHALL exclude that task from the All_Tasks_Page.
2. WHEN a parent task has been completed for less than the configured Threshold, THE Auto_Hide_Filter SHALL keep that task visible on the All_Tasks_Page.
3. THE Auto_Hide_Filter SHALL use the task's `completedAt` timestamp to calculate elapsed time since completion.

### Requirement 2: Auto-Hide Completed Subtasks

**User Story:** As a user, I want subtask visibility to depend on the parent task's status, so that I retain context for ongoing work while hiding stale subtasks.

#### Acceptance Criteria

1. WHILE a parent task is not completed, THE Auto_Hide_Filter SHALL keep all subtasks of that parent visible on the All_Tasks_Page regardless of each subtask's own completion status.
2. WHEN a parent task has been completed for longer than the configured Threshold, THE Auto_Hide_Filter SHALL exclude all subtasks of that parent from the All_Tasks_Page.
3. WHILE in Flat_Mode, THE Auto_Hide_Filter SHALL evaluate each task independently against the Threshold, keeping completed subtasks with an active parent visible.

### Requirement 3: Configurable Threshold

**User Story:** As a user, I want to configure how long completed tasks remain visible, so that I can tune the auto-hide behavior to my workflow.

#### Acceptance Criteria

1. THE All_Tasks_Page SHALL provide a Threshold setting accessible from the header area.
2. THE Threshold setting SHALL offer exactly four options: 24 hours, 48 hours, 1 week, and Never.
3. WHEN the Threshold is set to Never, THE Auto_Hide_Filter SHALL not hide any completed tasks based on time.
4. THE Threshold setting SHALL default to 24 hours on first use.
5. WHEN the user changes the Threshold, THE All_Tasks_Page SHALL persist the selection across sessions using the existing app settings store.
6. WHEN the user changes the Threshold, THE All_Tasks_Page SHALL apply the new Threshold immediately without requiring a page reload.

### Requirement 4: Interaction with Review Queue Mode

**User Story:** As a user, I want auto-hide to coexist with Review Queue mode without conflicts, so that switching modes produces predictable results.

#### Acceptance Criteria

1. WHILE Review_Queue_Mode is active, THE All_Tasks_Page SHALL hide all completed tasks regardless of the Threshold setting.
2. WHEN Review_Queue_Mode is deactivated, THE Auto_Hide_Filter SHALL resume applying the configured Threshold to completed tasks.

### Requirement 5: Interaction with Hide Completed Toggle

**User Story:** As a user, I want the Hide Completed toggle and auto-hide to layer correctly, so that toggling "Hide completed" off reveals only recently-completed tasks.

#### Acceptance Criteria

1. WHILE the Hide_Completed_Toggle is active, THE All_Tasks_Page SHALL hide all completed tasks regardless of the Threshold setting.
2. WHEN the Hide_Completed_Toggle is inactive and Review_Queue_Mode is inactive, THE Auto_Hide_Filter SHALL hide completed tasks that exceed the configured Threshold while keeping recently-completed tasks visible.

### Requirement 6: Interaction with Display Modes

**User Story:** As a user, I want auto-hide to work correctly in both Nested and Flat display modes, so that the behavior is consistent with each mode's semantics.

#### Acceptance Criteria

1. WHILE in Nested_Mode, WHEN a parent task is auto-hidden, THE Auto_Hide_Filter SHALL also hide all subtasks of that parent.
2. WHILE in Nested_Mode, WHEN a parent task is active, THE Auto_Hide_Filter SHALL keep completed subtasks of that parent visible for context.
3. WHILE in Flat_Mode, THE Auto_Hide_Filter SHALL evaluate each task independently against the Threshold.
4. WHILE in Flat_Mode, THE Auto_Hide_Filter SHALL keep a completed subtask visible when its parent task is not completed, regardless of the subtask's own completion age.

### Requirement 7: Progress Count Accuracy

**User Story:** As a user, I want progress counts to reflect all subtasks including auto-hidden ones, so that I have an accurate picture of completion status.

#### Acceptance Criteria

1. THE TaskRow component SHALL compute the progress count (e.g., "3/5") using the total number of subtasks, including those excluded by the Auto_Hide_Filter.
2. THE TaskRow component SHALL compute the completed count using all completed subtasks, including those excluded by the Auto_Hide_Filter.

### Requirement 8: Data Integrity

**User Story:** As a user, I want auto-hide to be a display-only filter, so that no task data is modified or deleted.

#### Acceptance Criteria

1. THE Auto_Hide_Filter SHALL operate as a read-time filter applied during rendering.
2. THE Auto_Hide_Filter SHALL not modify, delete, or alter any task data in the data store.
3. THE Auto_Hide_Filter SHALL not apply to project-specific views — only to the All_Tasks_Page.

### Requirement 9: Recently Completed View

**User Story:** As a user, I want a way to see recently auto-hidden tasks, so that I can reference completed work without cluttering the main task list.

#### Acceptance Criteria

1. THE All_Tasks_Page SHALL provide a UI element to reveal tasks that have been auto-hidden by the Threshold.
2. WHEN the Recently_Completed_View is activated, THE All_Tasks_Page SHALL display tasks that are completed and exceed the configured Threshold.
3. WHEN the Recently_Completed_View is deactivated, THE Auto_Hide_Filter SHALL resume normal filtering behavior.

### Requirement 10: Filter Function Architecture

**User Story:** As a developer, I want the auto-hide logic encapsulated in a pure service function, so that the filtering is testable and follows the existing architecture patterns.

#### Acceptance Criteria

1. THE Auto_Hide_Filter logic SHALL be implemented as a pure function in the service layer, accepting tasks and filter options as arguments and returning filtered tasks.
2. THE Auto_Hide_Filter function SHALL not import or depend on any Zustand store directly.
