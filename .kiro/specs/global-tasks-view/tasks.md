# Implementation Plan: Global Tasks View

## Overview

This implementation plan breaks down the Global Tasks View feature into incremental, testable steps. The approach follows these principles:

1. **Reuse existing components** - TaskList and TaskRow need minimal changes
2. **Minimal new code** - Only add what's absolutely necessary
3. **Follow existing patterns** - Use established patterns from the codebase
4. **Test incrementally** - Verify each component works before moving on

The implementation heavily reuses existing components and patterns:
- TaskList component (add one prop: `showProjectColumn`)
- TaskRow component (add one prop: `projectName`)
- Existing URL-based navigation pattern
- Existing store patterns (appStore, dataStore)
- Existing TaskDialog for task creation

## Tasks

- [ ] 1. Update type definitions and stores
  - [ ] 1.1 Update Task type to allow null projectId
    - Modify `types/index.ts` to change `projectId: UUID` to `projectId: UUID | null`
    - This allows tasks to exist without being linked to a project
    - _Requirements: 4.2_
  
  - [ ] 1.2 Extend appStore with global tasks display mode
    - Add `globalTasksDisplayMode: 'nested' | 'flat'` field to AppStore interface
    - Add `setGlobalTasksDisplayMode` action
    - Initialize with 'nested' as default
    - Persist to localStorage via zustand persist middleware (already configured)
    - _Requirements: 3.1, 3.5_
  
  - [ ]* 1.3 Write property test for display mode persistence
    - **Property 3: Display Mode Persistence**
    - **Validates: Requirements 3.5**

- [ ] 2. Add Project column to TaskList and TaskRow
  - [ ] 2.1 Modify TaskList to support Project column
    - Add `showProjectColumn?: boolean` prop to TaskListProps
    - When true, add Project column to table header (after Tags column)
    - Pass `showProjectColumn` prop down to TaskRow components
    - Add column resize handle for Project column (follow existing pattern)
    - _Requirements: 2.2, 2.3, 2.6_
  
  - [ ] 2.2 Modify TaskRow to display project name
    - Add `projectName?: string` prop to TaskRowProps
    - When `projectName` is provided, render it in Project column cell
    - Display "No Project" if task.projectId is null
    - Style consistently with other columns
    - _Requirements: 2.3, 2.4_
  
  - [ ]* 2.3 Write unit tests for Project column
    - Test TaskList renders Project column when showProjectColumn is true
    - Test TaskRow displays project name correctly
    - Test TaskRow displays "No Project" for null projectId
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 3. Create GlobalTasksView component
  - [ ] 3.1 Implement GlobalTasksView component
    - Create `components/GlobalTasksView.tsx`
    - Fetch all tasks from dataStore (no project filter)
    - Group tasks by project for display
    - Get display mode from appStore
    - Render GlobalTasksHeader component
    - Render TaskList with `showProjectColumn={true}`
    - Pass project name to each task for display
    - Handle empty state (no tasks)
    - _Requirements: 2.1, 2.5_
  
  - [ ]* 3.2 Write property test for complete task display
    - **Property 1: Complete Task Display**
    - **Validates: Requirements 2.5**
  
  - [ ]* 3.3 Write property test for project column display
    - **Property 2: Project Column Display**
    - **Validates: Requirements 2.3, 2.4**
  
  - [ ]* 3.4 Write unit tests for GlobalTasksView
    - Test component renders with empty task list
    - Test component renders with tasks from multiple projects
    - Test component renders tasks with null projectId
    - Test component groups tasks by project correctly
    - _Requirements: 2.1, 2.5_

- [ ] 4. Create GlobalTasksHeader component
  - [ ] 4.1 Implement GlobalTasksHeader component
    - Create `components/GlobalTasksHeader.tsx`
    - Add display mode toggle button (nested/flat) using existing Button component
    - Add "Add Task" button for creating unlinked tasks
    - Use existing icon components (from lucide-react)
    - Style consistently with existing headers
    - _Requirements: 3.3, 4.1_
  
  - [ ]* 4.2 Write unit tests for GlobalTasksHeader
    - Test display mode toggle updates appStore
    - Test "Add Task" button opens TaskDialog
    - Test button states and styling
    - _Requirements: 3.3, 4.1_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add sidebar navigation for global tasks
  - [ ] 6.1 Modify ProjectList component to add Tasks section
    - Add "Tasks" section above project list in `components/ProjectList.tsx`
    - Add horizontal separator (border-b) between Tasks and Projects
    - Highlight Tasks section when `/?view=tasks` is active
    - Navigate to `/?view=tasks` when Tasks section is clicked
    - Use existing icon and styling patterns
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 6.2 Write unit tests for sidebar navigation
    - Test Tasks section appears above Projects
    - Test separator is present
    - Test click navigates to global view
    - Test active state highlighting
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 7. Integrate GlobalTasksView into main page
  - [ ] 7.1 Add global tasks view to app/page.tsx
    - Check for `view=tasks` query parameter
    - When present, render GlobalTasksView instead of project view
    - Pass task click handlers to GlobalTasksView
    - Reuse existing TaskDetailPanel for task details
    - Handle URL navigation between global and project views
    - _Requirements: 1.2_
  
  - [ ]* 7.2 Write integration tests for navigation
    - Test navigating to `/?view=tasks` shows GlobalTasksView
    - Test navigating to `/?project=X` shows project view
    - Test task detail panel works in global view
    - Test URL updates correctly
    - _Requirements: 1.2_

- [ ] 8. Implement unlinked task creation
  - [ ] 8.1 Add unlinked task creation handler
    - Modify task creation handler in app/page.tsx
    - When in global view, create tasks with `projectId: null`
    - Reuse existing TaskDialog component
    - Update dataStore with new task
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 8.2 Write property test for unlinked task creation
    - **Property 4: Unlinked Task Creation**
    - **Validates: Requirements 4.2**
  
  - [ ]* 8.3 Write unit tests for unlinked task creation
    - Test task created with null projectId
    - Test task appears in global view
    - Test task persists to dataStore
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 9. Implement task interactions in global view
  - [ ] 9.1 Connect task completion handler
    - Reuse existing `handleTaskComplete` from app/page.tsx
    - Verify completion works for tasks with null projectId
    - Verify completion cascades to subtasks (existing behavior)
    - _Requirements: 5.2_
  
  - [ ] 9.2 Connect task detail panel
    - Reuse existing TaskDetailPanel component
    - Support opening task details from global view
    - Support task editing from global view
    - Support task deletion from global view
    - _Requirements: 5.1, 5.3_
  
  - [ ]* 9.3 Write property test for task completion consistency
    - **Property 5: Task Completion Consistency**
    - **Validates: Requirements 5.2, 8.1, 8.2**
  
  - [ ]* 9.4 Write property test for cross-view consistency
    - **Property 7: Cross-View Data Consistency**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  
  - [ ]* 9.5 Write unit tests for task interactions
    - Test task click opens detail panel
    - Test task completion toggle
    - Test task editing
    - Test task deletion
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Add basic filtering (Optional for MVP)
  - [ ] 11.1 Add filter state to GlobalTasksView
    - Add local state for filters (project, completion, priority)
    - Implement filter logic (simple array filtering)
    - Add "Clear Filters" button
    - _Requirements: 6.1, 6.2, 6.3, 6.7_
  
  - [ ] 11.2 Add filter UI controls
    - Add project multi-select dropdown
    - Add completion tri-state toggle (all/completed/incomplete)
    - Add priority multi-select dropdown
    - Use existing shadcn/ui components (Select, Button)
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 11.3 Write property test for filter application
    - **Property 6: Filter Application**
    - **Validates: Requirements 6.7**
  
  - [ ]* 11.4 Write unit tests for filtering
    - Test project filter
    - Test completion filter
    - Test priority filter
    - Test combined filters
    - Test clear filters
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

- [ ] 12. Handle edge cases and empty states
  - [ ] 12.1 Add empty state handling
    - Display "No tasks yet" when no tasks exist
    - Display "No tasks match filters" when filters return empty
    - Provide "Add Task" button in empty states
    - _Requirements: 2.1_
  
  - [ ] 12.2 Handle navigation edge cases
    - Handle deleted task in URL (close detail panel)
    - Handle invalid view parameter (default to project list)
    - Handle tasks with deleted projects (display "No Project")
  
  - [ ]* 12.3 Write unit tests for edge cases
    - Test empty state rendering
    - Test filtered empty state
    - Test navigation with deleted task
    - Test tasks with deleted projects

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation heavily reuses existing components (TaskList, TaskRow, TaskDialog)
- Filtering is optional for MVP - can be added later
- TMS integration is NOT included in this plan (requirements removed from scope)
- Drag-and-drop between projects is NOT included (too complex for MVP)
- Sorting is NOT included (can use existing column sorting in TaskList)
