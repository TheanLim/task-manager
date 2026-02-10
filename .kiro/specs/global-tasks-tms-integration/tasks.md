# Implementation Plan: Global Tasks TMS Integration

## Overview

This implementation plan adds Time Management System (TMS) functionality to the global tasks view by reusing existing TMS components (DITView, AF4View, FVPView) and adding conditional rendering logic. The approach minimizes changes to existing code while enabling TMS methodologies to work across all tasks from all projects.

## Tasks

- [ ] 1. Update GlobalTasksHeader to support TMS selector
  - [ ] 1.1 Add props for conditional rendering of TMS selector and display mode toggle
    - Add `showTMSSelector?: boolean` prop (default false for backward compatibility)
    - Add `showDisplayModeToggle?: boolean` prop (default true for backward compatibility)
    - Update component to conditionally render TMSSelector when `showTMSSelector` is true
    - Update component to conditionally render display mode toggle when `showDisplayModeToggle` is true
    - _Requirements: 1.1, 6.3, 6.4_
  
  - [ ]* 1.2 Write unit tests for GlobalTasksHeader conditional rendering
    - Test TMS selector renders when `showTMSSelector={true}`
    - Test TMS selector hidden when `showTMSSelector={false}`
    - Test display mode toggle renders when `showDisplayModeToggle={true}`
    - Test display mode toggle hidden when `showDisplayModeToggle={false}`
    - _Requirements: 1.1, 6.3, 6.4_

- [ ] 2. Add TMS view rendering to global tasks section in app/page.tsx
  - [ ] 2.1 Implement conditional rendering logic for TMS views
    - Import DITView, AF4View, FVPView components
    - Add conditional rendering based on `settings.timeManagementSystem`
    - Render DITView when TMS is DIT
    - Render AF4View when TMS is AF4
    - Render FVPView when TMS is FVP
    - Render GlobalTasksView when TMS is NONE
    - Pass all tasks (not filtered by project) to TMS components
    - Pass `showProjectInfo={true}` to TMS components
    - Pass `onProjectClick` handler for navigation
    - Update GlobalTasksHeader to show TMS selector and conditionally show display toggle
    - _Requirements: 1.2, 1.3, 2.1, 3.1, 4.1, 6.1, 6.2_
  
  - [ ]* 2.2 Write unit tests for TMS view rendering logic
    - Test DITView renders when TMS is DIT
    - Test AF4View renders when TMS is AF4
    - Test FVPView renders when TMS is FVP
    - Test GlobalTasksView renders when TMS is NONE
    - Test only one view renders at a time
    - _Requirements: 1.2, 1.3, 2.1, 3.1, 4.1, 6.1, 6.2_
  
  - [ ]* 2.3 Write property test for TMS view activation
    - **Property 1: TMS View Rendering**
    - **Validates: Requirements 1.2, 1.3, 2.1, 3.1, 4.1, 6.1, 6.2**

- [ ] 3. Checkpoint - Verify basic TMS rendering works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enhance TMS components to display project information
  - [ ] 4.1 Add project info props to DITView
    - Add `showProjectInfo?: boolean` prop to DITViewProps interface
    - Add `onProjectClick?: (projectId: string) => void` prop to DITViewProps interface
    - Import useDataStore to access projects
    - Update `renderTask` function to display project badge when `showProjectInfo` is true
    - Add click handler to project badge that calls `onProjectClick`
    - Display "No Project" for tasks with null projectId
    - Ensure project badge doesn't interfere with existing task rendering
    - _Requirements: 2.6, 7.1, 7.2, 7.3, 7.4, 8.4_
  
  - [ ] 4.2 Add project info props to AF4View
    - Add `showProjectInfo?: boolean` prop to AF4ViewProps interface
    - Add `onProjectClick?: (projectId: string) => void` prop to AF4ViewProps interface
    - Import useDataStore to access projects
    - Update `renderTask` function to display project badge when `showProjectInfo` is true
    - Add click handler to project badge that calls `onProjectClick`
    - Display "No Project" for tasks with null projectId
    - Ensure project badge doesn't interfere with existing task rendering
    - _Requirements: 3.6, 7.1, 7.2, 7.3, 7.4, 8.4_
  
  - [ ] 4.3 Add project info props to FVPView
    - Add `showProjectInfo?: boolean` prop to FVPViewProps interface
    - Add `onProjectClick?: (projectId: string) => void` prop to FVPViewProps interface
    - Import useDataStore to access projects
    - Update `renderTask` function to display project badge when `showProjectInfo` is true
    - Add click handler to project badge that calls `onProjectClick`
    - Display "No Project" for tasks with null projectId
    - Ensure project badge doesn't interfere with existing task rendering
    - _Requirements: 4.6, 7.1, 7.2, 7.3, 7.4, 8.4_
  
  - [ ]* 4.4 Write unit tests for project information display
    - Test project badge shows correct project name in DITView
    - Test project badge shows correct project name in AF4View
    - Test project badge shows correct project name in FVPView
    - Test "No Project" shows for unlinked tasks in all views
    - Test project click navigation works in all views
    - Test missing project handled gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 4.5 Write property test for project information display
    - **Property 4: Project Information Display**
    - **Validates: Requirements 2.6, 3.6, 4.6, 7.1, 7.2, 7.4**

- [ ] 5. Checkpoint - Verify project information displays correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add property-based tests for TMS functionality
  - [ ]* 6.1 Write property test for TMS operations being project-agnostic
    - **Property 2: TMS Operations Project-Agnostic**
    - **Validates: Requirements 2.2, 2.3, 3.2, 4.3**
  
  - [ ]* 6.2 Write property test for task visibility across projects
    - **Property 3: Task Visibility Across Projects**
    - **Validates: Requirements 2.5, 3.5, 4.2, 4.5, 8.2**
  
  - [ ]* 6.3 Write property test for TMS state consistency across views
    - **Property 5: TMS State Consistency Across Views**
    - **Validates: Requirements 5.2, 5.3, 9.1, 9.2, 9.3, 9.5**
  
  - [ ]* 6.4 Write property test for display mode toggle visibility
    - **Property 6: Display Mode Toggle Visibility**
    - **Validates: Requirements 6.3, 6.4**
  
  - [ ]* 6.5 Write property test for TMS state persistence
    - **Property 7: TMS State Persistence**
    - **Validates: Requirements 5.5**
  
  - [ ]* 6.6 Write property test for display mode preservation
    - **Property 8: Display Mode Preservation**
    - **Validates: Requirements 6.5**
  
  - [ ]* 6.7 Write property test for AF4 mark order preservation
    - **Property 9: AF4 Mark Order Preservation**
    - **Validates: Requirements 3.4**
  
  - [ ]* 6.8 Write property test for FVP dotted task order
    - **Property 10: FVP Dotted Task Order**
    - **Validates: Requirements 4.4**
  
  - [ ]* 6.9 Write property test for TMS metadata clearing
    - **Property 11: TMS Metadata Clearing**
    - **Validates: Requirements 5.4**
  
  - [ ]* 6.10 Write property test for project navigation
    - **Property 12: Project Navigation**
    - **Validates: Requirements 7.3**
  
  - [ ]* 6.11 Write property test for component backward compatibility
    - **Property 13: Component Backward Compatibility**
    - **Validates: Requirements 8.3, 8.4**

- [ ] 7. Add integration tests for complete user workflows
  - [ ]* 7.1 Write integration test for DIT workflow in global view
    - Test adding tasks to today/tomorrow lists
    - Test dragging tasks between lists
    - Test day rollover functionality
    - Test switching between global and project views maintains state
    - _Requirements: 2.2, 2.3, 2.4, 5.3, 9.1_
  
  - [ ]* 7.2 Write integration test for AF4 workflow in global view
    - Test marking and unmarking tasks
    - Test marked task order preservation
    - Test switching between global and project views maintains state
    - _Requirements: 3.2, 3.3, 3.4, 5.3, 9.2_
  
  - [ ]* 7.3 Write integration test for FVP workflow in global view
    - Test starting FVP selection
    - Test task comparison and dotting
    - Test completing selection and viewing working order
    - Test switching between global and project views maintains state
    - _Requirements: 4.2, 4.3, 4.4, 5.3, 9.3_
  
  - [ ]* 7.4 Write integration test for TMS switching workflow
    - Test switching between different TMS systems
    - Test metadata clearing on switch
    - Test display mode toggle visibility changes
    - Test display mode preservation
    - _Requirements: 5.4, 6.3, 6.4, 6.5_

- [ ] 8. Add error handling and edge cases
  - [ ] 8.1 Add error boundary for TMS views
    - Wrap TMS view rendering in ErrorBoundary component
    - Provide fallback UI with option to return to standard view
    - Log errors for debugging
    - _Requirements: Error Handling_
  
  - [ ]* 8.2 Write unit tests for error scenarios
    - Test missing project data handling
    - Test invalid TMS state handling
    - Test component rendering errors
    - Test navigation errors
    - _Requirements: Error Handling_

- [ ] 9. Final checkpoint - Comprehensive testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations each
- Unit tests validate specific examples and edge cases
- Integration tests validate complete user workflows
- The implementation reuses existing TMS components with minimal modifications
- All TMS state is already global, so no data model changes are needed
- The design follows the same pattern as project view TMS integration
