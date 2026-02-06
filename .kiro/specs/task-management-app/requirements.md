# Requirements Document: Task Management Web App

## Introduction

This document specifies the requirements for a task management web application inspired by Asana, with integrated time management methodologies. The system enables users to organize work into projects, tasks, and subtasks while providing multiple viewing perspectives and time management strategies. The application is designed as a single-user, client-side web app that persists data in localStorage and supports data portability through JSON import/export.

## Glossary

- **System**: The task management web application
- **User**: A person using the application to manage tasks
- **Project**: A container for organizing related tasks
- **Task**: A unit of work with properties like description, due date, and priority
- **Subtask**: A smaller unit of work nested within a parent task
- **Section**: A grouping mechanism for tasks within a project (used in list view)
- **Column**: A grouping mechanism for tasks within a project (used in board view)
- **Task_Dependency**: A relationship indicating one task blocks or is blocked by another
- **Time_Management_System**: A methodology for prioritizing and selecting tasks (DIT, AF4, FVP, or NONE)
- **DIT**: Do It Tomorrow - tasks added today are scheduled for tomorrow
- **AF4**: Autofocus 4 Revised - mark tasks you feel like doing and work through them
- **FVP**: Final Version Perfected - algorithm-based task selection using preference chains
- **View_Mode**: A display format for projects (List, Board, or Calendar)
- **localStorage**: Browser-based persistent storage mechanism
- **Data_Export**: JSON file containing all application data
- **Data_Import**: Process of loading data from a JSON file

## Requirements

### Requirement 1: Project Management

**User Story:** As a user, I want to create and manage projects, so that I can organize my work into logical groupings.

#### Acceptance Criteria

1. WHEN a user creates a project with a valid name, THE System SHALL create a new project and add it to the project list
2. WHEN a user attempts to create a project with an empty name, THE System SHALL prevent creation and display a validation error
3. WHEN a user edits a project name, THE System SHALL update the project name and persist the change to localStorage
4. WHEN a user deletes a project, THE System SHALL remove the project and all associated tasks from the system
5. THE System SHALL display all projects in a navigable list

### Requirement 2: Task Management

**User Story:** As a user, I want to create and manage tasks within projects, so that I can break down work into manageable pieces.

#### Acceptance Criteria

1. WHEN a user creates a task with a valid description within a project, THE System SHALL create the task and add it to the project
2. WHEN a user attempts to create a task with an empty description, THE System SHALL prevent creation and display a validation error
3. WHEN a user edits task properties (description, due date, priority, assignee), THE System SHALL update the task and persist changes to localStorage
4. WHEN a user deletes a task, THE System SHALL remove the task and all its subtasks from the system
5. WHEN a user marks a task as complete, THE System SHALL update the task status and persist the change
6. THE System SHALL support task properties including description, due date, priority (High, Medium, Low, None), assignee, and tags

### Requirement 3: Subtask Management

**User Story:** As a user, I want to break tasks into subtasks, so that I can manage complex work in smaller steps.

#### Acceptance Criteria

1. WHEN a user creates a subtask within a parent task, THE System SHALL create the subtask and associate it with the parent
2. WHEN a user deletes a parent task, THE System SHALL delete all associated subtasks
3. WHEN all subtasks of a task are marked complete, THE System SHALL visually indicate the parent task's subtask completion status
4. THE System SHALL display subtasks nested under their parent tasks
5. THE System SHALL support the same properties for subtasks as for regular tasks

### Requirement 4: Sections and Columns

**User Story:** As a user, I want to organize tasks into sections or columns within projects, so that I can group related work.

#### Acceptance Criteria

1. WHEN a user creates a section within a project, THE System SHALL create the section and allow tasks to be assigned to it
2. WHEN a user creates a column within a project, THE System SHALL create the column and allow tasks to be assigned to it
3. WHEN a user moves a task between sections or columns, THE System SHALL update the task's assignment and persist the change
4. WHEN a user deletes a section or column, THE System SHALL move all contained tasks to a default section or column
5. THE System SHALL display sections in list view and columns in board view

### Requirement 5: Task Dependencies

**User Story:** As a user, I want to set task dependencies, so that I can track which tasks block others and focus on actionable work.

#### Acceptance Criteria

1. WHEN a user marks task A as blocking task B, THE System SHALL create a dependency relationship between the tasks
2. WHEN a user marks task A as blocked by task B, THE System SHALL create a dependency relationship between the tasks
3. WHEN a user views a task with dependencies, THE System SHALL display all blocking and blocked-by relationships
4. WHEN a user deletes a task with dependencies, THE System SHALL remove all associated dependency relationships
5. THE System SHALL prevent circular dependencies (task A blocks B, B blocks A)
6. WHEN a user toggles the "show only actionable tasks" filter, THE System SHALL display only tasks that are not blocked by incomplete tasks
7. WHEN the "show only actionable tasks" filter is active, THE System SHALL hide tasks that have incomplete blocking dependencies
8. WHEN the "show all tasks" filter is active, THE System SHALL display all tasks regardless of blocking status
9. THE System SHALL persist the user's filter preference (show all vs show actionable) in localStorage

### Requirement 6: Multiple View Modes

**User Story:** As a user, I want to view my projects in different formats, so that I can choose the perspective that works best for my workflow.

#### Acceptance Criteria

1. WHEN a user selects list view for a project, THE System SHALL display tasks organized by sections in a vertical list
2. WHEN a user selects board view for a project, THE System SHALL display tasks organized by columns in a kanban board layout
3. WHEN a user selects calendar view for a project, THE System SHALL display tasks on a calendar based on their due dates
4. WHEN a user switches between views, THE System SHALL preserve the current project context and task data
5. THE System SHALL persist the user's preferred view mode per project in localStorage
6. **WHEN a Time Management System (DIT, AF4, or FVP) is active, THE System SHALL hide view mode controls and use the TMS-specific view instead**
7. **WHEN the Time Management System is set to NONE, THE System SHALL display view mode controls and allow switching between List, Board, and Calendar views**

**Design Decision:** View modes (List, Board, Calendar) only apply when no Time Management System is active. TMS views (DIT, AF4, FVP) have their own specialized layouts that override standard view modes. This prevents confusion and ensures each TMS can provide its optimal user experience.

### Requirement 7: Do It Tomorrow (DIT) Time Management System

**User Story:** As a user, I want to use the Do It Tomorrow methodology, so that I can focus on completing a closed list each day.

#### Acceptance Criteria

1. WHEN the DIT system is active and a user creates a task, THE System SHALL assign the task to tomorrow's list
2. WHEN a new day begins in DIT mode, THE System SHALL move yesterday's "tomorrow" list to "today" and create a new empty "tomorrow" list
3. WHEN a user views tasks in DIT mode, THE System SHALL display separate "today" and "tomorrow" lists
4. WHEN a user completes all tasks in today's list, THE System SHALL provide visual confirmation of completion
5. WHEN a user manually moves a task from tomorrow to today, THE System SHALL allow the move and update the task's scheduled date
6. WHEN a user drags a task from the "Tomorrow" section to the "Today" section, THE System SHALL move the task to today's list
7. WHEN a user drags a task from the "Today" section to the "Tomorrow" section, THE System SHALL move the task to tomorrow's list
8. WHEN a user drags an unscheduled task to either "Today" or "Tomorrow" section, THE System SHALL add the task to the appropriate list
9. WHEN either the "Today" or "Tomorrow" section contains more than 10 tasks, THE System SHALL make that section scrollable with a maximum height
10. WHEN a user drags a task, THE System SHALL provide visual feedback including drag preview and drop zone highlighting
11. THE System SHALL support both mouse drag-and-drop and touch drag-and-drop for mobile devices
12. THE System SHALL maintain keyboard accessibility with arrow button alternatives for users who cannot use drag-and-drop

### Requirement 8: Autofocus 4 Revised (AF4) Time Management System

**User Story:** As a user, I want to use the Autofocus 4 Revised methodology, so that I can work on tasks I feel motivated to do.

#### Acceptance Criteria

1. WHEN the AF4 system is active, THE System SHALL allow users to mark tasks they feel like doing
2. WHEN a user marks a task in AF4 mode, THE System SHALL visually distinguish marked tasks from unmarked tasks
3. WHEN a user views marked tasks in AF4 mode, THE System SHALL display them in the order they were marked
4. WHEN a user completes a marked task, THE System SHALL remove the mark and update the task status
5. WHEN a user unmarks a task in AF4 mode, THE System SHALL remove the mark and allow re-evaluation

### Requirement 9: Final Version Perfected (FVP) Time Management System

**User Story:** As a user, I want to use the Final Version Perfected methodology, so that I can use an algorithm-based approach to task selection.

#### Acceptance Criteria

1. WHEN the FVP system is active, THE System SHALL implement the FVP algorithm for task selection
2. WHEN a user starts FVP selection, THE System SHALL set the first task as X and prompt for comparison
3. WHEN a user indicates they want to do task Y before task X, THE System SHALL mark task Y (dot it) and set Y as the new X
4. WHEN a user completes FVP selection, THE System SHALL display dotted tasks in reverse order (last dotted first)
5. WHEN a user works on FVP tasks, THE System SHALL present the dotted tasks in the correct working order
6. WHEN a user completes a dotted task, THE System SHALL remove the dot and update the task status

### Requirement 10: Standard Mode (NONE)

**User Story:** As a user, I want to use standard task management without a time management system, so that I can work with traditional priority-based sorting.

#### Acceptance Criteria

1. WHEN standard mode is active, THE System SHALL display tasks without time management system constraints
2. WHEN a user sorts tasks in standard mode, THE System SHALL support sorting by priority, due date, creation date, and name
3. WHEN a user filters tasks in standard mode, THE System SHALL apply filters without time management system interference
4. THE System SHALL allow users to work on any task in any order in standard mode

### Requirement 11: Time Management System Switching

**User Story:** As a user, I want to switch between time management systems at any time, so that I can adapt my workflow to changing needs.

#### Acceptance Criteria

1. WHEN a user switches from one time management system to another, THE System SHALL preserve all task data
2. WHEN a user switches time management systems, THE System SHALL clear system-specific metadata (marks, dots, scheduled dates)
3. WHEN a user switches to a time management system, THE System SHALL apply that system's rules to the task display
4. THE System SHALL persist the active time management system selection in localStorage
5. WHEN a user switches time management systems, THE System SHALL provide a confirmation dialog explaining what will change

### Requirement 12: Search and Filtering

**User Story:** As a user, I want to search and filter tasks, so that I can quickly find specific work items.

#### Acceptance Criteria

1. WHEN a user enters a search query, THE System SHALL return all tasks matching the query in description, tags, or assignee
2. WHEN a user applies a filter by priority, THE System SHALL display only tasks matching the selected priority level
3. WHEN a user applies a filter by due date, THE System SHALL display only tasks within the selected date range
4. WHEN a user applies a filter by completion status, THE System SHALL display only completed or incomplete tasks as selected
5. WHEN a user applies multiple filters, THE System SHALL display tasks matching all filter criteria (AND logic)
6. WHEN a user clears filters, THE System SHALL restore the full task list

### Requirement 13: Data Persistence

**User Story:** As a user, I want my data to persist between sessions, so that I don't lose my work when I close the browser.

#### Acceptance Criteria

1. WHEN a user creates, updates, or deletes any data, THE System SHALL persist the change to localStorage immediately
2. WHEN a user opens the application, THE System SHALL load all data from localStorage
3. WHEN localStorage is empty, THE System SHALL initialize with an empty state
4. WHEN localStorage data is corrupted, THE System SHALL handle the error gracefully and notify the user
5. THE System SHALL store all projects, tasks, subtasks, sections, columns, dependencies, and settings in localStorage

### Requirement 14: Data Export

**User Story:** As a user, I want to export my data to JSON, so that I can back up my work or migrate to another system.

#### Acceptance Criteria

1. WHEN a user initiates data export, THE System SHALL generate a JSON file containing all application data
2. WHEN the JSON export is generated, THE System SHALL include all projects, tasks, subtasks, sections, columns, dependencies, and settings
3. WHEN the JSON export is generated, THE System SHALL include metadata such as export date and version
4. WHEN the JSON export is complete, THE System SHALL trigger a file download with a descriptive filename
5. THE System SHALL validate that the exported JSON is well-formed and complete

### Requirement 15: Data Import

**User Story:** As a user, I want to import data from JSON, so that I can restore a backup or migrate from another system.

#### Acceptance Criteria

1. WHEN a user selects a JSON file for import, THE System SHALL validate the file format and structure
2. WHEN the JSON file is valid, THE System SHALL parse the data and load it into the application
3. WHEN the JSON file is invalid, THE System SHALL display a descriptive error message and prevent import
4. WHEN importing data, THE System SHALL provide options to merge with existing data or replace all data
5. WHEN import is complete, THE System SHALL persist the imported data to localStorage and refresh the UI

### Requirement 16: Responsive Design

**User Story:** As a user, I want the application to work well on mobile and desktop, so that I can manage tasks on any device.

#### Acceptance Criteria

1. WHEN a user accesses the application on a mobile device, THE System SHALL display a mobile-optimized layout
2. WHEN a user accesses the application on a desktop device, THE System SHALL display a desktop-optimized layout
3. WHEN a user resizes the browser window, THE System SHALL adapt the layout responsively
4. WHEN a user interacts with touch gestures on mobile, THE System SHALL respond appropriately to swipes and taps
5. THE System SHALL ensure all functionality is accessible on both mobile and desktop devices

### Requirement 17: Static Export Compatibility

**User Story:** As a developer, I want the application to support static export, so that it can be hosted on GitHub Pages.

#### Acceptance Criteria

1. WHEN the application is built for production, THE System SHALL generate a static export with no server-side dependencies
2. WHEN the static export is deployed, THE System SHALL function correctly without a backend server
3. WHEN the application uses routing, THE System SHALL implement client-side routing compatible with static hosting
4. THE System SHALL not rely on server-side APIs or Node.js runtime features
5. THE System SHALL include all necessary assets (CSS, JavaScript, images) in the static export

### Requirement 19: Project Routing

**User Story:** As a user, I want each project to have its own shareable URL, so that I can bookmark specific projects and share links with others.

#### Acceptance Criteria

1. WHEN a user selects a project, THE System SHALL update the URL to include the project ID as a query parameter
2. WHEN a user navigates to a URL with a project query parameter, THE System SHALL display that specific project
3. WHEN a user navigates to the root URL without a project parameter, THE System SHALL display the project list
4. WHEN a user uses browser back/forward buttons, THE System SHALL navigate between projects correctly
5. WHEN a user shares a project URL, THE System SHALL open that specific project for the recipient
6. WHEN a user navigates to a URL with an invalid project ID, THE System SHALL redirect to the project list
7. THE System SHALL use query parameter routing (e.g., `/?project=abc-123`) to maintain static export compatibility

### Requirement 20: Inline Editing

**User Story:** As a user, I want to edit project and task titles directly by clicking on them, so that I can quickly rename items without opening dialogs or sidebars.

#### Acceptance Criteria

1. WHEN a user clicks on a project name in the header, THE System SHALL convert the name to an editable input field
2. WHEN a user clicks on a task description in any view, THE System SHALL convert the description to an editable input field
3. WHEN a user edits a project name inline and presses Enter or clicks outside, THE System SHALL save the changes and persist to localStorage
4. WHEN a user edits a task description inline and presses Enter or clicks outside, THE System SHALL save the changes and persist to localStorage
5. WHEN a user presses Escape while editing inline, THE System SHALL cancel the edit and restore the original value
6. WHEN a user attempts to save an empty project name or task description, THE System SHALL prevent the save and display a validation error
7. WHEN a user attempts to save a project name or task description that exceeds maximum length, THE System SHALL prevent the save and display a validation error
8. THE System SHALL provide visual feedback during inline editing (focus state, border highlight, etc.)
9. THE System SHALL maintain inline editing state independently for each editable field
10. WHEN inline editing is active, THE System SHALL prevent other interactions with that element until editing is complete

### Requirement 21: Project Tabs and Overview

**User Story:** As a user, I want to navigate between different views of a project using tabs, and have an overview page where I can edit project details and manage the project.

#### Acceptance Criteria

1. WHEN a user opens a project, THE System SHALL display a tabbed interface with tabs: Overview, List, Board, and Calendar
2. WHEN a user clicks on the Overview tab, THE System SHALL display the project overview page
3. WHEN a user clicks on the List tab, THE System SHALL display the list view with collapsible sections
4. WHEN a user clicks on the Board tab, THE System SHALL display the board view with columns
5. WHEN a user clicks on the Calendar tab, THE System SHALL display the calendar view
6. THE System SHALL persist the active tab selection per project in localStorage
7. WHEN a user navigates to a project URL without a tab parameter, THE System SHALL default to the Overview tab
8. THE System SHALL update the URL to include the active tab (e.g., `/?project=abc-123&tab=list`)

**Overview Tab Acceptance Criteria:**

9. WHEN a user is on the Overview tab, THE System SHALL display the project name (inline editable)
10. WHEN a user is on the Overview tab, THE System SHALL display the project description with an edit button or inline editing
11. WHEN a user edits the project description, THE System SHALL save the changes and persist to localStorage
12. WHEN a user is on the Overview tab, THE System SHALL display a "Danger Zone" section at the bottom
13. WHEN a user clicks "Delete Project" in the Danger Zone, THE System SHALL show a confirmation dialog
14. WHEN a user confirms project deletion, THE System SHALL delete the project and all associated tasks, then redirect to the project list
15. THE System SHALL display project metadata on the Overview tab (created date, last updated date, task count)

### Requirement 22: Collapsible Sections in List View

**User Story:** As a user, I want to organize tasks into collapsible sections in the list view, with default sections that map to board columns.

#### Acceptance Criteria

1. WHEN a user opens the List tab, THE System SHALL display tasks grouped by sections
2. THE System SHALL create default sections: "To Do", "Doing", and "Done" for new projects
3. WHEN a user views a section, THE System SHALL display it as expanded by default
4. WHEN a user clicks on a section header, THE System SHALL toggle the section between expanded and collapsed states
5. THE System SHALL persist the expanded/collapsed state of each section per project in localStorage
6. WHEN a user clicks "Add Section", THE System SHALL convert the button into an inline text input field for entering the section name
7. WHEN a user creates a new section in List view, THE System SHALL also create a corresponding column in Board view
8. WHEN a user renames a section in List view, THE System SHALL also rename the corresponding column in Board view
9. WHEN a user deletes a section in List view, THE System SHALL also delete the corresponding column in Board view
10. WHEN a user moves a task to a different section in List view, THE System SHALL also update the task's column in Board view
11. THE System SHALL maintain the mapping between sections (List view) and columns (Board view) automatically
12. WHEN a section is collapsed, THE System SHALL hide all tasks in that section but display the task count in the section header
13. WHEN a user views the List tab, THE System SHALL always display the default sections ("To Do", "Doing", "Done") with an "Add Section" button
14. WHEN a user clicks "Add tasks..." button in List view, THE System SHALL open the Task Dialog modal for creating a new task
15. WHEN a user drags a task in List view, THE System SHALL allow dropping it into any section to move it
16. WHEN a user drags a task within a section in List view, THE System SHALL allow reordering tasks within that section
17. WHEN a user drags a section header in List view, THE System SHALL allow reordering sections
18. WHEN a user views the Board tab, THE System SHALL display a "+ Add task" button at the end of each section
19. WHEN a user clicks "+ Add task" button in Board view, THE System SHALL open the Task Dialog modal for creating a new task
20. WHEN a user views the Board tab, THE System SHALL display a "+ Add section" button at the rightmost position
21. WHEN a user clicks "+ Add section" button in Board view, THE System SHALL convert the button into an inline text input field for entering the section name
22. WHEN a user clicks on a section name in Board view, THE System SHALL enable inline editing of the section name
23. WHEN a user drags a section in Board view, THE System SHALL allow reordering sections

### Requirement 18: Future Extensibility

**User Story:** As a developer, I want the data model to support future features, so that the application can grow without major refactoring.

#### Acceptance Criteria

1. WHEN designing the data model, THE System SHALL include fields for future features (comments, attachments, custom fields)
2. WHEN the data model is extended, THE System SHALL maintain backward compatibility with existing data
3. WHEN migrating from localStorage to a database, THE System SHALL support a clear migration path
4. THE System SHALL use TypeScript interfaces that can be extended without breaking changes
5. THE System SHALL structure code to allow easy addition of new view modes and time management systems

## Summary

This requirements document defines 22 core requirements for the task management web application, covering project management, task organization, time management methodologies, data persistence, and user experience. The system is designed as a single-user, client-side application with static export capability, making it suitable for hosting on platforms like GitHub Pages. Each requirement includes specific acceptance criteria that can be validated through testing.
