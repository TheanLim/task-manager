# Implementation Plan: Subtask Creation

## Overview

This implementation adds subtask creation functionality by extending the existing task creation workflow. The changes are minimal and follow established patterns in the codebase. The implementation focuses on state management for tracking parent task context, conditional UI rendering, property inheritance, and completion cascading.

## Tasks

- [x] 1. Add state management for parent task tracking
  - Add `taskDialogParentId` state variable to app/page.tsx
  - Initialize state to null
  - _Requirements: 4.1_

- [x] 2. Modify handleNewTask to accept parentTaskId parameter
  - [x] 2.1 Update handleNewTask function signature
    - Add optional `parentTaskId?: string` parameter
    - Set `taskDialogParentId` state when opening dialog
    - _Requirements: 1.1, 4.1_
  
  - [ ]* 2.2 Write property test for state tracking
    - **Property 7: Parent Task ID State Tracking**
    - **Validates: Requirements 4.1**

- [x] 3. Update handleTaskSubmit to use parent task ID
  - [x] 3.1 Modify task creation logic
    - Use `taskDialogParentId` instead of hardcoded null for `parentTaskId`
    - Calculate order based on subtask count if creating subtask
    - Reset `taskDialogParentId` to null after creation
    - _Requirements: 1.3, 1.4, 4.2_
  
  - [ ]* 3.2 Write property test for parent ID assignment
    - **Property 1: Subtask Parent ID Assignment**
    - **Validates: Requirements 1.3, 3.3**
  
  - [ ]* 3.3 Write property test for subtask ordering
    - **Property 3: Subtask Ordering**
    - **Validates: Requirements 1.4**
  
  - [ ]* 3.4 Write property test for state reset
    - **Property 8: State Reset After Dialog Close**
    - **Validates: Requirements 4.2**

- [x] 4. Implement property inheritance in TaskDialog
  - [x] 4.1 Add parentTask prop to TaskDialog interface
    - Add optional `parentTask?: Task | null` prop
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 4.2 Modify useEffect to pre-populate inherited fields
    - Check if parentTask is provided
    - Set assignee, priority, and tags from parent
    - Leave description, notes, and dueDate empty
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2_
  
  - [ ]* 4.3 Write property test for property inheritance
    - **Property 2: Property Inheritance from Parent**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  
  - [ ]* 4.4 Write unit test for inherited fields are editable
    - Test that user can modify inherited values in dialog
    - _Requirements: 2.6_

- [x] 5. Update TaskDialog usage in app/page.tsx
  - [x] 5.1 Pass parentTask prop to TaskDialog
    - Find parent task using `taskDialogParentId`
    - Pass to TaskDialog component
    - _Requirements: 6.2_

- [x] 6. Implement conditional Add Subtask button rendering
  - [x] 6.1 Modify TaskDetailPanel to conditionally show button
    - Check if `task.parentTaskId === null`
    - Only render "Add Subtask" button for top-level tasks
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [ ]* 6.2 Write property test for button visibility on top-level tasks
    - **Property 4: Add Subtask Button Visibility for Top-Level Tasks**
    - **Validates: Requirements 3.1**
  
  - [ ]* 6.3 Write property test for button hidden on subtasks
    - **Property 5: Add Subtask Button Hidden for Subtasks**
    - **Validates: Requirements 3.2**
  
  - [ ]* 6.4 Write unit test for button click behavior
    - Test that clicking button opens dialog with correct parent ID
    - _Requirements: 1.1_

- [x] 7. Implement onAddSubtask handler in app/page.tsx
  - [x] 7.1 Update onAddSubtask callback
    - Call `handleNewTask(selectedTask.sectionId, selectedTask.id)`
    - _Requirements: 1.1_

- [x] 8. Checkpoint - Ensure subtask creation works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement completion cascading
  - [x] 9.1 Modify handleTaskComplete to cascade to subtasks
    - Check if task is a parent (parentTaskId === null)
    - Get all subtasks using getSubtasks
    - Update each subtask's completed and completedAt fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 9.2 Write property test for completion cascade
    - **Property 9: Parent Completion Cascades to Subtasks**
    - **Validates: Requirements 5.1, 5.2**
  
  - [ ]* 9.3 Write property test for incompletion cascade
    - **Property 10: Parent Incompletion Cascades to Subtasks**
    - **Validates: Requirements 5.3, 5.4**
  
  - [ ]* 9.4 Write unit test for cascade error handling
    - Test that partial failures don't roll back parent completion
    - _Requirements: Error Handling_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows existing patterns in the codebase (TaskDialog reuse, state management in app/page.tsx)
