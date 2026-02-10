# Requirements Document

## Introduction

This document specifies the requirements for a Global Tasks View feature in the task management application. The feature will provide users with a unified view of all tasks across all projects, displayed in a table format similar to the existing List View. This view will be accessible from a new "Tasks" section in the sidebar, positioned above the Projects section.

## Glossary

- **Global_Tasks_View**: A unified view displaying all tasks from all projects in a single table
- **Task_Table**: The table component displaying tasks with columns for task properties and project association
- **Project_Column**: A column in the Task_Table showing which project each task belongs to
- **Sidebar_Tasks_Section**: A new section in the application sidebar for accessing the Global_Tasks_View
- **Unlinked_Task**: A task that is not associated with any project
- **Nested_Display**: The default display mode where subtasks appear indented under their parent tasks
- **Flat_Display**: An alternative display mode where all tasks and subtasks appear at the same hierarchical level
- **Task_Management_Application**: The existing Next.js/React application for managing tasks and projects
- **Time_Management_System**: A strategy for organizing and prioritizing tasks (DIT, AF4, FVP, or None)
- **DIT**: Do It Tomorrow - organizes tasks into "Today" and "Tomorrow" lists
- **AF4**: Autofocus 4 - allows marking tasks for prioritization
- **FVP**: Final Version Perfected - uses pairwise comparison to build a prioritized list
- **TMS_Metadata**: System-specific data associated with tasks (e.g., DIT schedule, AF4 marks, FVP dots)

## Requirements

### Requirement 1: Global Tasks View Navigation

**User Story:** As a user, I want to access a global view of all my tasks from the sidebar, so that I can see and manage all tasks across projects in one place.

#### Acceptance Criteria

1. THE Sidebar_Tasks_Section SHALL appear in the application sidebar above the Projects section
2. WHEN a user clicks on the Sidebar_Tasks_Section, THE Task_Management_Application SHALL display the Global_Tasks_View
3. THE Task_Management_Application SHALL display a horizontal line separator between the Sidebar_Tasks_Section and the Projects section
4. WHEN the Global_Tasks_View is active, THE Sidebar_Tasks_Section SHALL be visually highlighted to indicate the current view

### Requirement 2: Task Display and Organization

**User Story:** As a user, I want to see all my tasks in a table format with project information, so that I can quickly understand which tasks belong to which projects.

#### Acceptance Criteria

1. THE Global_Tasks_View SHALL display tasks in a table format similar to the existing List View
2. THE Task_Table SHALL include all columns from the existing List View (Name, Due Date, Priority, Assignee, Tags)
3. THE Task_Table SHALL include an additional Project_Column showing the project name for each task
4. WHEN a task is an Unlinked_Task, THE Project_Column SHALL display a placeholder indicator (such as "No Project" or "-")
5. THE Task_Table SHALL display tasks from all projects in the application
6. THE Task_Table SHALL support the same column resizing functionality as the existing List View

### Requirement 3: Subtask Display Modes

**User Story:** As a user, I want to control how subtasks are displayed in the global view, so that I can choose between seeing task hierarchy or a flat list of all tasks.

#### Acceptance Criteria

1. THE Global_Tasks_View SHALL display subtasks in Nested_Display mode by default
2. WHEN in Nested_Display mode, THE Task_Table SHALL show subtasks indented under their parent tasks
3. THE Global_Tasks_View SHALL provide a toggle control for switching between Nested_Display and Flat_Display modes
4. WHEN a user activates Flat_Display mode, THE Task_Table SHALL display all tasks and subtasks at the same hierarchical level without indentation
5. WHEN switching between display modes, THE Task_Management_Application SHALL preserve the user's selection for future sessions

### Requirement 4: Unlinked Task Creation

**User Story:** As a user, I want to create tasks that are not associated with any project, so that I can track personal or miscellaneous tasks separately.

#### Acceptance Criteria

1. THE Global_Tasks_View SHALL provide a control for creating new Unlinked_Tasks
2. WHEN a user creates an Unlinked_Task, THE Task_Management_Application SHALL create a task with a null projectId
3. WHEN an Unlinked_Task is created, THE Task_Table SHALL display the new task with the appropriate placeholder in the Project_Column
4. THE Task_Management_Application SHALL persist Unlinked_Tasks to storage

### Requirement 5: Task Interaction and Management

**User Story:** As a user, I want to interact with tasks in the global view the same way I do in project views, so that I have a consistent experience across the application.

#### Acceptance Criteria

1. WHEN a user clicks on a task in the Task_Table, THE Task_Management_Application SHALL open the task detail panel
2. WHEN a user marks a task as complete in the Task_Table, THE Task_Management_Application SHALL update the task's completion status
3. THE Task_Table SHALL support inline editing of task properties consistent with the existing List View
4. THE Task_Table SHALL support drag-and-drop reordering of tasks within the same project
5. WHEN a user drags a task to a different project in the Task_Table, THE Task_Management_Application SHALL update the task's projectId
6. THE Task_Table SHALL display task dependencies consistent with the existing List View

### Requirement 6: Task Filtering and Sorting

**User Story:** As a user, I want to filter and sort tasks in the global view, so that I can focus on specific subsets of tasks.

#### Acceptance Criteria

1. THE Global_Tasks_View SHALL support filtering tasks by project
2. THE Global_Tasks_View SHALL support filtering tasks by completion status
3. THE Global_Tasks_View SHALL support filtering tasks by priority
4. THE Global_Tasks_View SHALL support filtering tasks by assignee
5. THE Global_Tasks_View SHALL support filtering tasks by tags
6. THE Task_Table SHALL support sorting by any column (Name, Due Date, Priority, Assignee, Tags, Project)
7. WHEN filters are applied, THE Task_Table SHALL display only tasks matching all active filter criteria

### Requirement 7: Performance and Scalability

**User Story:** As a user with many tasks across multiple projects, I want the global view to load and respond quickly, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN the Global_Tasks_View contains more than 100 tasks, THE Task_Management_Application SHALL implement virtualization for the Task_Table
2. WHEN loading the Global_Tasks_View, THE Task_Management_Application SHALL display all tasks within 500 milliseconds for datasets up to 1000 tasks
3. WHEN applying filters or sorting, THE Task_Table SHALL update within 200 milliseconds
4. THE Task_Management_Application SHALL maintain smooth scrolling performance in the Task_Table with up to 1000 visible tasks

### Requirement 8: Data Consistency

**User Story:** As a user, I want changes made in the global view to be reflected in project views and vice versa, so that my data remains consistent across the application.

#### Acceptance Criteria

1. WHEN a task is modified in the Global_Tasks_View, THE Task_Management_Application SHALL update the task in the underlying data store
2. WHEN a task is modified in a project view, THE Global_Tasks_View SHALL reflect the changes when displayed
3. WHEN a task is deleted in the Global_Tasks_View, THE Task_Management_Application SHALL remove the task from all views
4. WHEN a task is created in the Global_Tasks_View, THE Task_Management_Application SHALL make the task available in the appropriate project view
5. THE Task_Management_Application SHALL maintain referential integrity for task relationships (parent-child, dependencies) across all views

### Requirement 9: Time Management System Integration

**User Story:** As a user, I want to use time management system strategies in the global tasks view, so that I can prioritize and organize all my tasks regardless of which project they belong to.

#### Acceptance Criteria

1. THE Global_Tasks_View SHALL support all Time_Management_System strategies (None, DIT, AF4, FVP)
2. WHEN a Time_Management_System is active, THE Task_Table SHALL display TMS_Metadata for each task (e.g., DIT schedule indicators, AF4 marks, FVP dots)
3. WHEN using DIT, THE Global_Tasks_View SHALL provide controls for adding tasks to "Today" and "Tomorrow" lists
4. WHEN using AF4, THE Global_Tasks_View SHALL provide controls for marking and unmarking tasks
5. WHEN using FVP, THE Global_Tasks_View SHALL support the pairwise comparison workflow for task prioritization
6. WHEN a Time_Management_System is active, THE Task_Table SHALL support filtering tasks by TMS_Metadata (e.g., show only "Today" tasks in DIT, show only marked tasks in AF4)
7. WHEN a Time_Management_System is active, THE Task_Table SHALL support sorting tasks according to the system's prioritization rules
8. THE Global_Tasks_View SHALL display the currently active Time_Management_System
9. WHEN switching Time_Management_Systems, THE Task_Management_Application SHALL preserve TMS_Metadata according to the system's rules
