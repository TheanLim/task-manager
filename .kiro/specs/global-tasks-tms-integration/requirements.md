# Requirements Document

## Introduction

This document specifies the requirements for integrating Time Management System (TMS) functionality into the global tasks view. The application currently supports three TMS implementations (DIT, AF4, FVP) that work in project-specific views. This feature extends TMS functionality to work across all tasks from all projects in the global tasks view.

## Glossary

- **TMS (Time Management System)**: A methodology for organizing and prioritizing tasks (DIT, AF4, or FVP)
- **Global Tasks View**: The view accessible at `/?view=tasks` that displays all tasks from all projects
- **Project View**: A view showing tasks for a specific project
- **DIT (Do It Tomorrow)**: A TMS that organizes tasks into "Today" and "Tomorrow" lists
- **AF4 (Autofocus 4)**: A TMS that allows marking tasks for focus
- **FVP (Final Version Perfected)**: A TMS using pairwise comparison to build a prioritized list
- **TMS Metadata**: System-specific data (today/tomorrow lists, marked tasks, dotted tasks)
- **Standard View**: The default table/list view without TMS active
- **TMS View**: The specialized interface shown when a TMS is active

## Requirements

### Requirement 1: TMS Selector in Global View

**User Story:** As a user, I want to select a TMS from the global tasks view, so that I can apply time management methodologies across all my tasks.

#### Acceptance Criteria

1. WHEN a user is in the global tasks view, THE System SHALL display a TMS selector component
2. WHEN a user selects a TMS (DIT, AF4, or FVP), THE System SHALL activate that TMS for the global view
3. WHEN a user selects "None" as the TMS, THE System SHALL display the standard table view
4. WHEN a TMS is already active in the application settings, THE Global_View SHALL reflect that active TMS on load
5. THE TMS_Selector SHALL display the same options and behavior as in project views

### Requirement 2: Global DIT View

**User Story:** As a user, I want to use DIT methodology in the global tasks view, so that I can organize all my tasks across projects into today and tomorrow lists.

#### Acceptance Criteria

1. WHEN DIT is active in the global view, THE System SHALL display the DITView component
2. WHEN a user moves a task to "Today", THE System SHALL add that task to the global today list regardless of its project
3. WHEN a user moves a task to "Tomorrow", THE System SHALL add that task to the global tomorrow list regardless of its project
4. WHEN a user drags a task between lists, THE System SHALL update the global DIT metadata
5. THE DIT_View SHALL display all tasks from all projects in the appropriate lists (Today, Tomorrow, Unscheduled)
6. WHEN tasks are displayed in DIT view, THE System SHALL show which project each task belongs to

### Requirement 3: Global AF4 View

**User Story:** As a user, I want to use AF4 methodology in the global tasks view, so that I can mark and focus on tasks across all my projects.

#### Acceptance Criteria

1. WHEN AF4 is active in the global view, THE System SHALL display the AF4View component
2. WHEN a user marks a task, THE System SHALL add that task to the global marked tasks list regardless of its project
3. WHEN a user unmarks a task, THE System SHALL remove that task from the global marked tasks list
4. THE AF4_View SHALL maintain the order in which tasks were marked globally
5. THE AF4_View SHALL display all tasks from all projects in the appropriate sections (Marked, Unmarked)
6. WHEN tasks are displayed in AF4 view, THE System SHALL show which project each task belongs to

### Requirement 4: Global FVP View

**User Story:** As a user, I want to use FVP methodology in the global tasks view, so that I can prioritize tasks across all my projects using pairwise comparison.

#### Acceptance Criteria

1. WHEN FVP is active in the global view, THE System SHALL display the FVPView component
2. WHEN a user starts FVP selection, THE System SHALL present tasks from all projects for comparison
3. WHEN a user selects a task during FVP comparison, THE System SHALL add it to the global dotted tasks list
4. WHEN a user completes FVP selection, THE System SHALL display dotted tasks in reverse order (working order)
5. THE FVP_View SHALL work with tasks from all projects in the comparison process
6. WHEN tasks are displayed in FVP view, THE System SHALL show which project each task belongs to

### Requirement 5: TMS Metadata Scope

**User Story:** As a user, I want TMS metadata to work globally, so that my time management organization applies across all projects.

#### Acceptance Criteria

1. WHEN a TMS is active, THE System SHALL store TMS metadata globally (not per-project)
2. WHEN a task is added to a TMS list in global view, THE System SHALL use the same metadata store as project views
3. WHEN switching between global view and project views, THE System SHALL maintain consistent TMS metadata
4. WHEN a user switches TMS systems, THE System SHALL clear all TMS metadata as it currently does
5. THE System SHALL persist TMS metadata across browser sessions

### Requirement 6: View Switching Behavior

**User Story:** As a user, I want smooth transitions between standard and TMS views, so that I can easily switch between different ways of viewing my tasks.

#### Acceptance Criteria

1. WHEN a TMS is active (not "None"), THE Global_View SHALL display the TMS-specific interface instead of the standard table view
2. WHEN TMS is set to "None", THE Global_View SHALL display the standard table view with nested/flat mode toggle
3. WHEN switching from standard to TMS view, THE System SHALL hide the nested/flat mode toggle
4. WHEN switching from TMS to standard view, THE System SHALL restore the nested/flat mode toggle
5. THE System SHALL preserve the user's last selected display mode (nested/flat) when returning to standard view

### Requirement 7: Project Information Display

**User Story:** As a user, I want to see which project each task belongs to in TMS views, so that I can maintain context while working across projects.

#### Acceptance Criteria

1. WHEN tasks are displayed in any TMS view in the global context, THE System SHALL show the project name for each task
2. WHEN a task has no project (unlinked task), THE System SHALL indicate this clearly
3. WHEN a user clicks on a project name in a TMS view, THE System SHALL navigate to that project's view
4. THE Project_Information SHALL be displayed consistently across all three TMS views (DIT, AF4, FVP)

### Requirement 8: Component Reusability

**User Story:** As a developer, I want to reuse existing TMS components, so that the implementation is maintainable and consistent.

#### Acceptance Criteria

1. WHEN implementing global TMS views, THE System SHALL reuse the existing DITView, AF4View, and FVPView components
2. WHEN TMS components are used in global view, THE System SHALL pass all tasks from all projects as props
3. THE TMS_Components SHALL not require modification to their core logic to work in global context
4. WHEN displaying project information, THE System SHALL extend the existing task rendering without breaking existing functionality

### Requirement 9: TMS State Consistency

**User Story:** As a user, I want TMS state to remain consistent whether I'm in global view or project view, so that my task organization doesn't change based on which view I'm using.

#### Acceptance Criteria

1. WHEN a task is in the "Today" list in global view, THE System SHALL show it in the "Today" list in project view
2. WHEN a task is marked in AF4 in project view, THE System SHALL show it as marked in global view
3. WHEN a task is dotted in FVP in global view, THE System SHALL show it as dotted in project view
4. THE System SHALL use a single source of truth for all TMS metadata
5. WHEN TMS metadata is updated in any view, THE System SHALL reflect those changes immediately in all views
