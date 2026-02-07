# Implementation Plan: Task Management Web App

## Overview

This implementation plan breaks down the task management web app into incremental, testable steps. The approach follows a bottom-up strategy: core data models and state management first, then UI components, then time management systems, and finally integration and polish.

## Tasks

- [x] 1. Project Setup and Core Infrastructure
  - Initialize Next.js 14 project with TypeScript and App Router
  - Configure Tailwind CSS and install shadcn/ui
  - Set up Vitest and React Testing Library
  - Install dependencies: zustand, date-fns, lucide-react, fast-check
  - Configure static export in next.config.js
  - Create basic folder structure (app/, components/, stores/, lib/, types/)
  - _Requirements: 17.1, 17.2, 17.3_

- [x] 2. Define Core Type Definitions
  - Create types/index.ts with all TypeScript interfaces
  - Define enums: Priority, ViewMode, TimeManagementSystem
  - Define interfaces: Project, Task, Section, Column, TaskDependency, TMSState, AppSettings, AppState
  - Define UUID and ISODateString type aliases
  - Export all types for use throughout the application
  - _Requirements: 1.1, 2.1, 4.1, 4.2, 5.1, 7.1, 8.1, 9.1, 10.1_

- [ ] 3. Implement Data Store with Zustand
  - [x] 3.1 Create useDataStore with persist middleware
    - Implement state structure (projects, tasks, sections, columns, dependencies)
    - Implement project CRUD actions (addProject, updateProject, deleteProject)
    - Implement task CRUD actions (addTask, updateTask, deleteTask)
    - Implement section CRUD actions (addSection, updateSection, deleteSection)
    - Implement column CRUD actions (addColumn, updateColumn, deleteColumn)
    - Implement dependency actions (addDependency, deleteDependency)
    - Implement cascading deletion logic (project → tasks, task → subtasks, task → dependencies)
    - Implement selector functions (getProjectById, getTasksByProjectId, getSubtasks, etc.)
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.3, 2.4, 3.1, 4.1, 4.2, 4.3, 4.4, 5.1, 5.4, 13.1_
  
  - [ ]* 3.2 Write property test for project creation
    - **Property 1: Project Creation Adds to List**
    - **Validates: Requirements 1.1**
  
  - [ ]* 3.3 Write property test for project deletion cascading
    - **Property 4: Project Deletion Cascades**
    - **Validates: Requirements 1.4**
  
  - [ ]* 3.4 Write property test for task deletion cascading
    - **Property 8: Task Deletion Cascades to Subtasks**
    - **Validates: Requirements 2.4, 3.2**
  
  - [ ]* 3.5 Write unit tests for data store
    - Test project CRUD operations
    - Test task CRUD operations with subtasks
    - Test section/column deletion moves tasks to default
    - Test dependency deletion when task is deleted
    - _Requirements: 1.1, 1.4, 2.1, 2.4, 4.4, 5.4_

- [ ] 4. Implement TMS Store with Zustand
  - [x] 4.1 Create useTMSStore with persist middleware
    - Implement TMSState structure (activeSystem, dit, af4, fvp)
    - Implement setActiveSystem action
    - Implement DIT actions (addToToday, addToTomorrow, moveToToday, performDayRollover)
    - Implement AF4 actions (markTask, unmarkTask)
    - Implement FVP actions (startFVPSelection, selectFVPTask, skipFVPTask, endFVPSelection, resetFVP)
    - Implement clearSystemMetadata action
    - _Requirements: 7.1, 7.2, 7.5, 8.1, 8.5, 9.2, 9.3, 11.1, 11.2, 11.4_
  
  - [ ]* 4.2 Write property test for DIT day rollover
    - **Property 23: DIT Day Rollover**
    - **Validates: Requirements 7.2**
  
  - [ ]* 4.3 Write property test for AF4 marking order
    - **Property 26: AF4 Marking Order Preserved**
    - **Validates: Requirements 8.3**
  
  - [ ]* 4.4 Write property test for FVP dotted task ordering
    - **Property 30: FVP Dotted Task Ordering**
    - **Validates: Requirements 9.4, 9.5**
  
  - [ ]* 4.5 Write unit tests for TMS store
    - Test DIT day rollover logic
    - Test AF4 mark/unmark operations
    - Test FVP selection flow
    - Test clearSystemMetadata
    - _Requirements: 7.2, 8.1, 8.5, 9.3, 11.2_

- [ ] 5. Implement App and Filter Stores
  - [x] 5.1 Create useAppStore with persist middleware
    - Implement AppSettings structure
    - Implement setActiveProject action
    - Implement setTimeManagementSystem action
    - Implement setShowOnlyActionableTasks action
    - Implement setTheme action
    - _Requirements: 5.9, 6.5, 11.4_
  
  - [x] 5.2 Create useFilterStore (no persistence)
    - Implement filter state (searchQuery, priorityFilter, dateRangeFilter, completionFilter)
    - Implement filter actions (setSearchQuery, setPriorityFilter, setDateRangeFilter, setCompletionFilter, clearFilters)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6_
  
  - [ ]* 5.3 Write property test for settings persistence
    - **Property 19: Filter Preference Persists**
    - **Property 21: View Mode Preference Persists**
    - **Property 36: TMS Selection Persists**
    - **Validates: Requirements 5.9, 6.5, 11.4**

- [x] 6. Implement Validation Utilities
  - Create lib/validation.ts with validation functions
  - Implement validateProjectName (non-empty, max 200 chars)
  - Implement validateTaskDescription (non-empty, max 500 chars)
  - Implement validateSectionName (non-empty, max 100 chars)
  - Implement validateColumnName (non-empty, max 100 chars)
  - Define ValidationError class
  - _Requirements: 1.2, 2.2_
  
  - [ ]* 6.1 Write property test for empty name rejection
    - **Property 2: Empty Project Names Are Rejected**
    - **Property 6: Empty Task Descriptions Are Rejected**
    - **Validates: Requirements 1.2, 2.2**

- [x] 7. Implement Dependency Resolver
  - Create lib/dependencyResolver.ts with DependencyResolverImpl class
  - Implement isTaskBlocked method
  - Implement getBlockingTasks method
  - Implement getBlockedTasks method
  - Implement hasCircularDependency method using BFS
  - Implement getActionableTasks method
  - _Requirements: 5.5, 5.6_
  
  - [ ]* 7.1 Write property test for circular dependency detection
    - **Property 17: Circular Dependencies Are Prevented**
    - **Validates: Requirements 5.5**
  
  - [ ]* 7.2 Write property test for actionable task filtering
    - **Property 18: Actionable Task Filtering**
    - **Validates: Requirements 5.6, 5.7**
  
  - [ ]* 7.3 Write unit tests for dependency resolver
    - Test circular dependency detection with various cycles
    - Test actionable task filtering with complex dependency chains
    - Test edge cases (no dependencies, all tasks blocked)
    - _Requirements: 5.5, 5.6_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Time Management System Handlers
  - [x] 9.1 Create lib/tms/ directory and base interface
    - Define TimeManagementSystemHandler interface
    - Create factory function to get handler by system type
    - _Requirements: 7.1, 8.1, 9.1, 10.1_
  
  - [x] 9.2 Implement DITHandler class
    - Implement initialize method with day change detection
    - Implement getOrderedTasks method (today tasks first, then tomorrow)
    - Implement onTaskCreated method (add to tomorrow)
    - Implement onTaskCompleted method (remove from today)
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [x] 9.3 Implement AF4Handler class
    - Implement initialize method (no-op)
    - Implement getOrderedTasks method (marked first in order, then unmarked)
    - Implement onTaskCreated method (no-op)
    - Implement onTaskCompleted method (remove mark)
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [x] 9.4 Implement FVPHandler class
    - Implement initialize method (no-op)
    - Implement getOrderedTasks method (dotted in reverse order, then undotted)
    - Implement onTaskCreated method (no-op)
    - Implement onTaskCompleted method (remove dot, reset X if needed)
    - _Requirements: 9.3, 9.4, 9.6_
  
  - [x] 9.5 Implement StandardHandler class
    - Implement initialize method (no-op)
    - Implement getOrderedTasks method (sort by order field)
    - Implement onTaskCreated method (no-op)
    - Implement onTaskCompleted method (no-op)
    - _Requirements: 10.2_
  
  - [ ]* 9.6 Write property test for TMS task preservation
    - **Property 34: TMS Switching Preserves Tasks**
    - **Validates: Requirements 11.1**
  
  - [ ]* 9.7 Write property test for TMS metadata clearing
    - **Property 35: TMS Switching Clears Metadata**
    - **Validates: Requirements 11.2**

- [x] 10. Implement Storage Adapter for Import/Export
  - Create lib/storage.ts with StorageAdapter interface
  - Implement LocalStorageAdapter class
  - Implement load method with error handling
  - Implement save method with error handling
  - Implement clear method
  - Implement exportToJSON method (include metadata)
  - Implement importFromJSON method with validation
  - Implement validateState method
  - Define StorageError and ImportError classes
  - _Requirements: 13.2, 13.4, 14.1, 14.3, 14.5, 15.1, 15.2, 15.3_
  
  - [ ]* 10.1 Write property test for localStorage round trip
    - **Property 44: localStorage Round Trip**
    - **Validates: Requirements 13.2**
  
  - [ ]* 10.2 Write property test for import/export round trip
    - **Property 49: Import/Export Round Trip**
    - **Validates: Requirements 15.2**
  
  - [ ]* 10.3 Write property test for export completeness
    - **Property 46: Export Completeness**
    - **Validates: Requirements 14.1, 14.2, 14.3**
  
  - [ ]* 10.4 Write unit tests for storage adapter
    - Test corrupted data handling
    - Test invalid JSON import
    - Test export includes all data and metadata
    - _Requirements: 13.4, 14.5, 15.1, 15.3_

- [x] 11. Implement Core UI Components with shadcn/ui
  - [x] 11.1 Set up shadcn/ui components
    - Install and configure shadcn/ui CLI
    - Add components: button, input, card, dialog, dropdown-menu, select, calendar, badge, separator, tabs, checkbox
    - _Requirements: 16.1, 16.2_
  
  - [x] 11.2 Create Layout component
    - Implement responsive layout with sidebar and main content area
    - Add navigation header
    - Add mobile menu toggle
    - _Requirements: 16.1, 16.2, 16.3_
  
  - [x] 11.3 Create ProjectList component
    - Display list of projects
    - Handle project selection
    - Add "New Project" button
    - Show empty state when no projects
    - _Requirements: 1.1, 1.5_
  
  - [x] 11.4 Create ProjectDialog component
    - Form for creating/editing projects
    - Validate project name
    - Handle form submission
    - Show validation errors
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 11.5 Write unit tests for project components
    - Test ProjectList renders projects correctly
    - Test ProjectDialog validation
    - Test project creation flow
    - _Requirements: 1.1, 1.2_

- [ ] 12. Implement Task Components
  - [x] 12.1 Create TaskList component (List View)
    - Display tasks grouped by sections
    - Show task properties (description, due date, priority, tags)
    - Handle task selection
    - Support drag-and-drop reordering
    - Show subtasks nested under parents
    - _Requirements: 2.1, 3.4, 4.5_
  
  - [x] 12.2 Create TaskBoard component (Board View)
    - Display tasks in columns (kanban style)
    - Support drag-and-drop between columns
    - Show task cards with key properties
    - _Requirements: 4.5, 6.2_
  
  - [x] 12.3 Create TaskCalendar component (Calendar View)
    - Display tasks on calendar by due date
    - Handle date selection
    - Show tasks without due dates in separate area
    - _Requirements: 6.3_
  
  - [x] 12.4 Create TaskDialog component
    - Form for creating/editing tasks
    - Support all task properties (description, notes, assignee, priority, tags, due date)
    - Validate task description
    - Handle form submission
    - _Requirements: 2.1, 2.2, 2.3, 2.6_
  
  - [x] 12.5 Create TaskDetailPanel component
    - Display full task details
    - Show subtasks list
    - Show dependencies (blocking/blocked by)
    - Add subtask button
    - Add dependency button
    - Edit and delete buttons
    - _Requirements: 2.3, 3.1, 5.3_
  
  - [ ]* 12.6 Write unit tests for task components
    - Test TaskList renders tasks correctly
    - Test TaskBoard drag-and-drop
    - Test TaskDialog validation
    - Test TaskDetailPanel displays all information
    - _Requirements: 2.1, 2.2, 4.3_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement Section and Column Management
  - [x] 14.1 Create SectionManager component
    - Display sections for a project
    - Add new section button
    - Edit section name inline
    - Delete section with confirmation
    - Reorder sections via drag-and-drop
    - _Requirements: 4.1, 4.4_
  
  - [x] 14.2 Create ColumnManager component
    - Display columns for a project
    - Add new column button
    - Edit column name inline
    - Delete column with confirmation
    - Reorder columns via drag-and-drop
    - _Requirements: 4.2, 4.4_
  
  - [ ]* 14.3 Write property test for section/column deletion
    - **Property 14: Section/Column Deletion Preserves Tasks**
    - **Validates: Requirements 4.4**

- [x] 15. Implement Dependency Management
  - [x] 15.1 Create DependencyDialog component
    - Search/select task to create dependency with
    - Choose dependency type (blocks/blocked by)
    - Validate no circular dependencies
    - Show error if circular dependency detected
    - _Requirements: 5.1, 5.5_
  
  - [x] 15.2 Create DependencyList component
    - Display blocking tasks
    - Display blocked tasks
    - Remove dependency button
    - Visual indication of blocked status
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 15.3 Write unit tests for dependency components
    - Test circular dependency prevention
    - Test dependency creation and deletion
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 16. Implement Search and Filtering
  - [x] 16.1 Create SearchBar component
    - Text input for search query
    - Real-time search as user types
    - Clear search button
    - _Requirements: 12.1_
  
  - [x] 16.2 Create FilterPanel component
    - Priority filter dropdown
    - Date range picker
    - Completion status filter
    - "Show only actionable tasks" toggle
    - Clear all filters button
    - _Requirements: 12.2, 12.3, 12.4, 5.6_
  
  - [x] 16.3 Implement filtering logic
    - Create useFilteredTasks hook
    - Apply search query filter (description, tags, assignee)
    - Apply priority filter
    - Apply date range filter
    - Apply completion status filter
    - Apply actionable tasks filter (using DependencyResolver)
    - Combine all filters with AND logic
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 5.6_
  
  - [ ]* 16.4 Write property test for search functionality
    - **Property 37: Search Matches All Fields**
    - **Validates: Requirements 12.1**
  
  - [ ]* 16.5 Write property test for multiple filters
    - **Property 41: Multiple Filters Combine with AND**
    - **Validates: Requirements 12.5**
  
  - [ ]* 16.6 Write property test for clearing filters
    - **Property 42: Clearing Filters Restores Full List**
    - **Validates: Requirements 12.6**

- [ ] 17. Implement Time Management System UI
  - [x] 17.1 Create TMSSelector component
    - Dropdown to select TMS (None, DIT, AF4, FVP)
    - Show confirmation dialog when switching
    - Explain what will change when switching
    - _Requirements: 11.1, 11.2, 11.5_
  
  - [x] 17.2 Create DITView component
    - Display "Today" and "Tomorrow" sections
    - Show tasks in each section
    - "Move to Today" button for tomorrow tasks
    - Visual indication of day completion
    - _Requirements: 7.3, 7.5_
  
  - [x] 17.3 Create AF4View component
    - Display marked and unmarked tasks
    - "Mark" button for unmarked tasks
    - "Unmark" button for marked tasks
    - Visual distinction between marked/unmarked
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [x] 17.4 Create FVPView component
    - Display FVP selection interface
    - "Start Selection" button
    - During selection: show current X and comparison prompt
    - "Do this before X" and "Skip" buttons
    - "End Selection" button
    - Display dotted tasks in working order
    - "Reset" button to clear dots
    - _Requirements: 9.2, 9.3, 9.4_
  
  - [ ]* 17.5 Write unit tests for TMS UI components
    - Test TMS switching with confirmation
    - Test DIT day sections
    - Test AF4 marking/unmarking
    - Test FVP selection flow
    - _Requirements: 7.1, 8.1, 9.3, 11.2_

- [ ] 17.6 Enhance DIT View with Drag-and-Drop
  - [ ] 17.6.1 Add missing TMS store actions
    - Implement moveToTomorrow action
    - Implement removeFromSchedule action
    - Update store interface and tests
    - _Requirements: 7.6, 7.7, 7.8_
  
  - [ ] 17.6.2 Install and configure drag-and-drop library
    - Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
    - Configure DndContext in DITView
    - Set up droppable zones for Today, Tomorrow, Unscheduled
    - _Requirements: 7.6, 7.7, 7.8, 7.10_
  
  - [ ] 17.6.3 Implement drag-and-drop functionality
    - Make task cards draggable
    - Implement drop handlers for each section
    - Add visual feedback (drag overlay, drop zone highlighting)
    - Handle drag end events to update store
    - _Requirements: 7.6, 7.7, 7.8, 7.10, 7.11_
  
  - [ ] 17.6.4 Add scrollable sections
    - Set max-height on Today section (400px when > 10 tasks)
    - Set max-height on Tomorrow section (400px when > 10 tasks)
    - Add smooth scrolling behavior
    - Style scrollbars for better UX
    - _Requirements: 7.9_
  
  - [ ] 17.6.5 Maintain accessibility
    - Keep arrow buttons as keyboard alternative
    - Add ARIA labels for drag-and-drop
    - Test with keyboard navigation
    - Test with screen readers
    - _Requirements: 7.12_
  
  - [ ]* 17.6.6 Write tests for drag-and-drop
    - Test moveToTomorrow action
    - Test removeFromSchedule action
    - Test drag-and-drop between sections
    - Test scrollable section behavior
    - _Requirements: 7.6, 7.7, 7.8, 7.9_

- [x] 18. Implement View Mode Switching
  - Create ViewModeSelector component
  - Toggle between List, Board, and Calendar views
  - Persist view mode per project
  - Ensure data is preserved when switching views
  - **Hide view mode controls when TMS is active (DIT, AF4, FVP)**
  - **Show view mode controls only when TMS is NONE**
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - _Design Decision: View modes and TMS are mutually exclusive - TMS views override standard view modes_
  
  - [ ]* 18.1 Write property test for view switching
    - **Property 20: View Switching Preserves Data**
    - **Validates: Requirements 6.4**

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Implement Import/Export UI
  - [x] 20.1 Create ExportButton component
    - Trigger data export
    - Generate JSON file with timestamp in filename
    - Download file to user's device
    - Show success message
    - _Requirements: 14.1, 14.4_
  
  - [x] 20.2 Create ImportDialog component
    - File input for JSON file
    - Validate file before import
    - Show preview of data to be imported
    - Options: "Merge with existing" or "Replace all"
    - Confirmation before applying import
    - Show error messages for invalid files
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ]* 20.3 Write unit tests for import/export UI
    - Test export generates valid JSON
    - Test import validation
    - Test import error handling
    - _Requirements: 14.5, 15.1, 15.3_

- [x] 21. Implement Error Handling and Error Boundary
  - Create ErrorBoundary component
  - Create ErrorFallback component with recovery options
  - Implement error handling in all store actions
  - Add user-friendly error messages
  - Handle localStorage quota exceeded
  - Handle localStorage access denied (private browsing)
  - _Requirements: 13.4_
  
  - [ ]* 21.1 Write property test for corrupted data handling
    - **Property 45: Corrupted Data Handling**
    - **Validates: Requirements 13.4**

- [x] 22. Implement Theme Support
  - Create ThemeProvider component
  - Implement light/dark/system theme modes
  - Add theme toggle in settings
  - Persist theme preference
  - Apply theme classes to root element
  - _Requirements: 16.1, 16.2_

- [x] 23. Implement Responsive Design
  - Add responsive breakpoints to all components
  - Optimize mobile layout (collapsible sidebar, bottom navigation)
  - Optimize tablet layout
  - Test touch interactions (drag-and-drop, swipe gestures)
  - Ensure all functionality works on mobile
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 24. Implement Main App Page
  - Create app/page.tsx as main entry point
  - Integrate all components (Layout, ProjectList, TaskList/Board/Calendar, etc.)
  - Handle routing between projects
  - Initialize stores on app load
  - Check for day change on app load (for DIT)
  - _Requirements: 13.2, 7.2_

- [x] 25. Configure Static Export
  - Update next.config.js for static export
  - Set output: 'export'
  - Configure image optimization for static export
  - Test build process (npm run build)
  - Verify static files are generated correctly
  - Test deployment to local server
  - _Requirements: 17.1, 17.2, 17.5_

- [x] 26. Implement Project Routing with Query Parameters
  - Update app/page.tsx to use query parameter routing
  - Import useSearchParams and useRouter from 'next/navigation'
  - Read 'project' query parameter to determine which view to show
  - Show project list when no parameter is present
  - Show specific project view when parameter exists
  - Redirect to project list if project ID is invalid
  - Update ProjectList component to use router.push with query parameters
  - Test URL sharing and browser back/forward navigation
  - Update documentation with routing information
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_
  
  - [ ]* 26.1 Write unit tests for routing
    - Test project list displays when no query parameter
    - Test project view displays with valid project ID
    - Test redirect to list with invalid project ID
    - Test browser navigation (back/forward)
    - _Requirements: 19.2, 19.3, 19.6_

- [x] 27. Implement Inline Editing for Projects and Tasks
  - [x] 27.1 Create InlineEditable component
    - Create components/InlineEditable.tsx with controlled input pattern
    - Implement display mode with click-to-edit functionality
    - Implement edit mode with input field and auto-focus
    - Add keyboard shortcuts (Enter to save, Escape to cancel)
    - Add blur handler to save on click outside
    - Implement validation integration
    - Add error display for validation failures
    - Add visual feedback (hover states, focus styles, error states)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_
  
  - [x] 27.2 Integrate inline editing for project names
    - Update app/page.tsx header to use InlineEditable for project name
    - Connect to updateProject action from dataStore
    - Use validateProjectName for validation
    - Test inline editing in header
    - _Requirements: 20.1, 20.3, 20.5, 20.6, 20.7_
  
  - [x] 27.3 Integrate inline editing for task descriptions
    - Update TaskList component to use InlineEditable for task descriptions
    - Update TaskBoard component to use InlineEditable for task descriptions
    - Update TaskCalendar component to use InlineEditable for task descriptions
    - Update DITView component to use InlineEditable for task descriptions
    - Update AF4View component to use InlineEditable for task descriptions
    - Update FVPView component to use InlineEditable for task descriptions
    - Connect to updateTask action from dataStore
    - Use validateTaskDescription for validation
    - Test inline editing in all views
    - _Requirements: 20.2, 20.4, 20.5, 20.6, 20.7_
  
  - [ ]* 27.4 Write unit tests for InlineEditable component
    - Test display mode renders value correctly
    - Test clicking activates edit mode
    - Test Enter key saves changes
    - Test Escape key cancels changes
    - Test blur saves changes
    - Test validation prevents invalid saves
    - Test error message display
    - Test empty value validation
    - Test max length validation
    - _Requirements: 20.3, 20.4, 20.5, 20.6, 20.7_
  
  - [ ]* 27.5 Write integration tests for inline editing
    - Test editing project name in header
    - Test editing task description in list view
    - Test editing task description in board view
    - Test validation errors prevent save
    - Test changes persist to localStorage
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.6_

- [-] 28. Implement Project Tabs and Overview
  - [x] 28.1 Update data model for unified sections
    - Remove Column interface from types/index.ts
    - Add collapsed field to Section interface
    - Update Task interface to use only sectionId (remove columnId)
    - Update all type exports
    - _Requirements: 22.1, 22.11_
  
  - [x] 28.2 Migrate data store from columns to sections
    - Remove column CRUD actions from useDataStore
    - Update section actions to handle both List and Board views
    - Add toggleSectionCollapsed action
    - Update getColumnsByProjectId to getSectionsByProjectId (if not already done)
    - Update all task operations to use sectionId only
    - _Requirements: 22.7, 22.8, 22.9, 22.10, 22.11_
  
  - [x] 28.3 Create default sections for new projects
    - Update addProject action to create default sections: "To Do", "Doing", "Done"
    - Set default collapsed state to false (expanded)
    - Set proper order values (0, 1, 2)
    - _Requirements: 22.2, 22.3_
  
  - [x] 28.4 Implement tab routing
    - Update app/page.tsx to read tab query parameter
    - Add tab state management (default to 'overview')
    - Implement navigateToTab function to update URL
    - Persist active tab per project in localStorage
    - _Requirements: 21.1, 21.6, 21.7, 21.8_
  
  - [x] 28.5 Create ProjectTabs component
    - Create components/ProjectTabs.tsx
    - Implement Tabs component with Overview, List, Board, Calendar tabs
    - Handle tab change events
    - Update URL on tab change
    - Style tabs appropriately
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_
  
  - [x] 28.6 Create ProjectOverview component
    - Create components/ProjectOverview.tsx
    - Display project name (inline editable)
    - Display project description with textarea
    - Display project metadata (created date, updated date, task counts)
    - Implement Danger Zone section with delete button
    - Add delete confirmation dialog
    - Handle project deletion and redirect to project list
    - _Requirements: 21.9, 21.10, 21.11, 21.12, 21.13, 21.14, 21.15_
  
  - [x] 28.7 Update TaskList for collapsible sections with table-like view
    - Add section header with collapse/expand button
    - Display task count in section header
    - Implement toggle functionality
    - Persist collapsed state to localStorage
    - Add section actions menu (rename, delete)
    - Add "Add Section" button at the bottom
    - Add "Add tasks..." button at the end of each section
    - Implement table-like task row structure:
      - Tick round button (green when completed, gray when incomplete)
      - Task name/description (clickable)
      - Configurable columns (due date, priority, assignee, tags)
      - Expand/collapse button for tasks with subtasks (left of task name)
      - "View Subtasks" button for tasks with subtasks (opens sidebar focused on subtasks)
      - "Details" button (opens task sidebar)
    - Display subtasks indented beneath parent when expanded
    - Implement drag-and-drop for tasks between sections
    - _Requirements: 22.1, 22.3, 22.4, 22.5, 22.6, 22.12, 22.13, 22.14, 22.15, 22.16, 22.17, 22.18, 22.19, 22.20, 22.21, 22.22, 22.23_
  
  - [x] 28.8 Update TaskBoard to use sections with add buttons
    - Update TaskBoard to receive sections instead of columns
    - Update drag-and-drop to use sectionId
    - Update all references from column to section
    - Add "+ Add task" button at the end of each section
    - Add "+ Add section" button at the rightmost position
    - Ensure visual consistency with previous board view
    - _Requirements: 22.7, 22.8, 22.9, 22.10, 22.11, 22.16, 22.17_

- [x] 28.10. Enhance List and Board Views with Advanced Interactions
  - [x] 28.10.1 Update "Add Task" buttons to open Task Dialog
    - Change TaskList "+ Add tasks..." button to open TaskDialog modal
    - Change TaskBoard "+ Add task" button to open TaskDialog modal
    - Pass sectionId to TaskDialog to pre-assign new task to section
    - _Requirements: 22.14, 22.19_
  
  - [x] 28.10.2 Implement inline "Add Section" input
    - Convert "Add Section" button to inline input field on click in List view
    - Convert "+ Add section" button to inline input field on click in Board view
    - Add Enter to confirm, Escape to cancel
    - Add visual feedback for input state
    - _Requirements: 22.6, 22.21_
  
  - [x] 28.10.3 Implement task reordering within sections in List view
    - Add drag-and-drop for reordering tasks within the same section
    - Update task order field when reordered
    - Provide visual feedback during drag
    - _Requirements: 22.16_
  
  - [x] 28.10.4 Implement section reordering in List view
    - Make section headers draggable
    - Allow reordering sections via drag-and-drop
    - Update section order field when reordered
    - Persist new order to localStorage
    - _Requirements: 22.17_
  
  - [x] 28.10.5 Implement inline section name editing in Board view
    - Make section name clickable for inline editing in Board view
    - Use InlineEditable component for section names
    - Validate section name on save
    - _Requirements: 22.22_
  
  - [x] 28.10.6 Implement section reordering in Board view
    - Make section columns draggable
    - Allow reordering sections via drag-and-drop
    - Update section order field when reordered
    - Persist new order to localStorage
    - _Requirements: 22.23_
  
  - [x] 28.9 Integrate tabs into project page
    - Update app/page.tsx to use ProjectTabs component
    - Move existing view mode logic into appropriate tabs
    - Remove old view mode selector from header
    - Update header to show project name only
    - Test navigation between tabs
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [x] 28.9.1 Implement TaskRow component for table-like list view
    - Create TaskRow component with all interactive elements:
      - Conditional expand/collapse subtasks button (chevron icon)
      - Completion tick button (green/gray, toggles on click)
      - Task name/description (clickable, opens sidebar)
      - Configurable columns section (due date, priority, assignee, tags)
      - Conditional "View Subtasks" button (opens sidebar, scrolls to subtasks)
      - "Details" button (always visible, opens sidebar)
    - Implement subtask expansion state (local component state)
    - Display subtasks indented beneath parent when expanded
    - Add hover states for all interactive elements
    - Support drag-and-drop for task reordering
    - Add responsive behavior (hide columns on mobile)
    - _Requirements: 22.15, 22.16, 22.17, 22.18, 22.19, 22.20, 22.21, 22.22, 22.23_
  
  - [x]* 28.9.2 Write unit tests for TaskRow component
    - Test tick button toggles completion status
    - Test task name click opens sidebar
    - Test Details button opens sidebar
    - Test expand/collapse button toggles subtask visibility
    - Test "View Subtasks" button opens sidebar and focuses subtasks
    - Test configurable columns display correctly
    - Test hover states
    - Test responsive behavior
    - _Requirements: 22.15, 22.16, 22.17, 22.18, 22.19, 22.20, 22.21, 22.22_
  
  - [ ]* 28.10 Write unit tests for new components
    - Test ProjectTabs tab switching
    - Test ProjectOverview displays all information
    - Test ProjectOverview delete confirmation
    - Test collapsible section toggle
    - Test section CRUD operations
    - _Requirements: 21.1, 21.13, 22.4_
  
  - [ ]* 28.11 Write integration tests for tabs and sections
    - Test tab navigation updates URL
    - Test tab state persists across page reloads
    - Test section collapse state persists
    - Test section-to-board synchronization
    - Test project deletion from overview
    - _Requirements: 21.6, 21.8, 22.5, 22.11, 21.14_

- [ ] 29. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 30. Integration Testing
  - [ ]* 30.1 Write integration test for complete project workflow
    - Create project → Add tasks → Organize into sections → Complete tasks
    - _Requirements: 1.1, 2.1, 4.1, 2.5_
  
  - [ ]* 30.2 Write integration test for TMS switching
    - Switch between all TMS modes → Verify state transitions
    - _Requirements: 11.1, 11.2_
  
  - [ ]* 30.3 Write integration test for data persistence
    - Create data → Export → Clear → Import → Verify integrity
    - _Requirements: 14.1, 15.2_
  
  - [ ]* 30.4 Write integration test for filtering and search
    - Apply multiple filters → Search → Verify results
    - _Requirements: 12.1, 12.5_
  
  - [ ]* 30.5 Write integration test for dependencies
    - Create dependencies → Delete tasks → Verify cleanup
    - _Requirements: 5.1, 5.4_
  
  - [ ]* 30.6 Write integration test for project tabs
    - Navigate between tabs → Verify content changes
    - Test tab state persistence
    - _Requirements: 21.1, 21.6_
  
  - [ ]* 30.7 Write integration test for collapsible sections
    - Toggle sections → Verify state persists
    - Test section-board synchronization
    - _Requirements: 22.4, 22.5, 22.11_

- [ ] 31. Polish and Accessibility
  - Add loading states for async operations
  - Add empty states for all lists
  - Add confirmation dialogs for destructive actions
  - Ensure keyboard navigation works throughout
  - Add ARIA labels and roles
  - Test with screen reader
  - Add focus indicators
  - Ensure color contrast meets WCAG 2.1 AA
  - _Requirements: 16.5_

- [x] 32. Documentation
  - Create README.md with project overview
  - Document how to run the project locally
  - Document how to build for production
  - Document how to deploy to GitHub Pages
  - Add inline code comments for complex logic
  - Document time management system algorithms
  - _Requirements: 17.1, 17.2_

- [ ] 33. Final Testing and Deployment
  - Run full test suite
  - Fix any failing tests
  - Build for production
  - Test static export locally
  - Create GitHub repository
  - Set up GitHub Pages deployment
  - Deploy to GitHub Pages
  - Verify deployed app works correctly
  - _Requirements: 17.1, 17.2, 17.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate complete workflows
- The implementation follows a bottom-up approach: data layer → business logic → UI → integration
