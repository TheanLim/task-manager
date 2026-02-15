# Implementation Plan: Completed Task Auto-Hide

## Overview

Implement a time-based auto-hide filter for completed tasks on the All Tasks page. The work proceeds bottom-up: schema → service (pure function) → store → components. Property-based tests validate the core filter logic, unit tests cover edge cases, and integration tests verify component wiring.

## Tasks

- [x] 1. Add AutoHideThreshold schema and type
  - [x] 1.1 Add `AutoHideThresholdSchema` to `lib/schemas.ts` and extend `AppSettingsSchema` with `autoHideThreshold` field (optional, default `'24h'`)
    - Add `z.enum(['24h', '48h', '1w', 'never'])` schema
    - Add optional field to `AppSettingsSchema` with `.default('24h')`
    - _Requirements: 3.2, 3.4_

- [ ] 2. Implement auto-hide filter service
  - [x] 2.1 Create `features/tasks/services/autoHideService.ts` with `getThresholdMs`, `isTaskAutoHidden`, and `filterAutoHiddenTasks` functions
    - `getThresholdMs(threshold)` → returns ms or null for 'never'
    - `isTaskAutoHidden(task, thresholdMs, now)` → boolean based on `completedAt`
    - `filterAutoHiddenTasks(tasks, allTasks, options)` → `{ visible, autoHidden }`
    - Handle nested mode: subtask visibility follows parent auto-hide status
    - Handle flat mode: independent evaluation with active-parent exception
    - Handle edge case: `completed: true` but `completedAt: null` → keep visible
    - Handle edge case: `parentTaskId` references missing parent → evaluate independently
    - Accept `now` parameter for testability
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.3, 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 10.1, 10.2_

  - [ ]* 2.2 Write property test: Threshold boundary for parent tasks
    - **Property 1: Threshold boundary for parent tasks**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 2.3 Write property test: Nested mode subtask visibility follows parent
    - **Property 2: Nested mode subtask visibility follows parent**
    - **Validates: Requirements 2.1, 2.2, 6.1, 6.2**

  - [ ]* 2.4 Write property test: Flat mode independent evaluation with active-parent exception
    - **Property 3: Flat mode independent evaluation with active-parent exception**
    - **Validates: Requirements 2.3, 6.3, 6.4**

  - [ ]* 2.5 Write property test: 'Never' threshold returns all tasks unchanged
    - **Property 4: 'Never' threshold returns all tasks unchanged**
    - **Validates: Requirements 3.3**

  - [ ]* 2.6 Write property test: Filter does not mutate input
    - **Property 7: Filter does not mutate input**
    - **Validates: Requirements 8.2**

  - [ ]* 2.7 Write property test: Visible and autoHidden partition the input
    - **Property 8: Visible and autoHidden partition the input**
    - **Validates: Requirements 9.2**

  - [ ]* 2.8 Write unit tests for edge cases and helper functions
    - Test `getThresholdMs` returns correct ms for each option
    - Test `isTaskAutoHidden` with known inputs
    - Test `completedAt: null` with `completed: true` → stays visible
    - Test exact threshold boundary → task is hidden
    - Test empty task array → empty result
    - _Requirements: 1.1, 1.2, 1.3, 3.3_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add store fields and header UI
  - [x] 4.1 Add `autoHideThreshold` and `showRecentlyCompleted` to `appStore.ts`
    - Add `autoHideThreshold: '24h'` default and `showRecentlyCompleted: false` default
    - Add `setAutoHideThreshold` and `setShowRecentlyCompleted` actions
    - Persist via existing `persist` middleware
    - _Requirements: 3.4, 3.5, 9.1_

  - [x] 4.2 Add threshold dropdown and recently-completed toggle to `GlobalTasksHeader.tsx`
    - Threshold dropdown: only visible when Review Queue is inactive
    - Recently Completed toggle: only visible when threshold !== 'never' and Review Queue is inactive
    - _Requirements: 3.1, 3.2, 3.6, 9.1_

  - [ ]* 4.3 Write unit tests for GlobalTasksHeader new controls
    - Test threshold dropdown renders with four options
    - Test recently-completed toggle visibility conditions
    - _Requirements: 3.1, 3.2, 9.1_

- [ ] 5. Integrate filter into GlobalTasksView
  - [x] 5.1 Replace inline completed-task filter in `GlobalTasksView.tsx` with `filterAutoHiddenTasks`
    - Review Queue or Hide Completed active → existing behavior (hide all completed)
    - Normal mode → call `filterAutoHiddenTasks` with threshold and display mode
    - Recently Completed mode → show only auto-hidden tasks
    - Pass `hideCompletedSubtasks` based on combined filter state
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 9.2, 9.3_

  - [ ]* 5.2 Write property test: Override modes hide all completed tasks
    - **Property 5: Override modes hide all completed tasks**
    - Test at component level that review queue and hide-completed override auto-hide
    - **Validates: Requirements 4.1, 5.1**

  - [ ]* 5.3 Write property test: Progress count invariant
    - **Property 6: Progress count invariant**
    - Verify TaskRow progress count uses raw subtask data, not filtered
    - **Validates: Requirements 7.1, 7.2**

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The filter function is pure and testable in isolation — no store mocking needed
- Progress counts (7.1, 7.2) are already correct in the existing TaskRow implementation since it uses `rawSubtasks` — task 5.3 verifies this invariant holds after integration
