# Specification Updates: View Modes and TMS Interaction

## Date: January 31, 2026

## Summary
Updated requirements, design, and tasks documents to reflect the design decision that view modes (List, Board, Calendar) and Time Management Systems (DIT, AF4, FVP) are mutually exclusive display modes.

## Design Decision

**View modes and TMS are mutually exclusive:**
- When TMS is set to "None": View mode controls are visible, users can switch between List/Board/Calendar
- When TMS is active (DIT, AF4, or FVP): View mode controls are hidden, TMS-specific view is shown

**Rationale:**
1. **Specialized layouts**: Each TMS has a layout optimized for its specific workflow
2. **Avoid confusion**: Combining TMS logic with standard views would create hybrid interfaces
3. **Full control**: Each TMS needs complete control over task presentation
4. **Better UX**: Clear separation reduces cognitive load and improves usability

## Files Updated

### 1. requirements.md ✅

**Section**: Requirement 6: Multiple View Modes

**Added Acceptance Criteria:**
- **6.6**: WHEN a Time Management System (DIT, AF4, or FVP) is active, THE System SHALL hide view mode controls and use the TMS-specific view instead
- **6.7**: WHEN the Time Management System is set to NONE, THE System SHALL display view mode controls and allow switching between List, Board, and Calendar views

**Added Design Decision Note:**
> View modes (List, Board, Calendar) only apply when no Time Management System is active. TMS views (DIT, AF4, FVP) have their own specialized layouts that override standard view modes. This prevents confusion and ensures each TMS can provide its optimal user experience.

### 2. design.md ✅

**Section**: State Management Architecture (after store descriptions)

**Added New Section**: View Mode and Time Management System Interaction

**Content:**
- Design decision statement
- Rationale (4 key points)
- Implementation details
- User experience considerations

**Key Points:**
- Mutual exclusivity clearly stated
- Implementation logic documented
- UX benefits explained
- Preference preservation noted

### 3. tasks.md ✅

**Section**: Task 18: Implement View Mode Switching

**Updated Task Description:**
- Added: "Hide view mode controls when TMS is active (DIT, AF4, FVP)"
- Added: "Show view mode controls only when TMS is NONE"
- Updated requirements reference: Added 6.6, 6.7
- Added design decision note

**Before:**
```markdown
- [x] 18. Implement View Mode Switching
  - Create ViewModeSelector component
  - Toggle between List, Board, and Calendar views
  - Persist view mode per project
  - Ensure data is preserved when switching views
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
```

**After:**
```markdown
- [x] 18. Implement View Mode Switching
  - Create ViewModeSelector component
  - Toggle between List, Board, and Calendar views
  - Persist view mode per project
  - Ensure data is preserved when switching views
  - **Hide view mode controls when TMS is active (DIT, AF4, FVP)**
  - **Show view mode controls only when TMS is NONE**
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - _Design Decision: View modes and TMS are mutually exclusive - TMS views override standard view modes_
```

### 4. VIEW_MODES_IMPLEMENTATION.md ✅

**Section**: Overview

**Added Design Decision:**
> **Important Design Decision**: View modes (List, Board, Calendar) only apply when Time Management System is set to "None". When a TMS (DIT, AF4, or FVP) is active, it uses its own specialized view and the view mode controls are hidden. This prevents confusion and ensures each TMS can provide its optimal user experience.

**Section**: View Mode Integration

**Enhanced with:**
- Conditional rendering logic for view mode selector
- Design rationale (4 key points)
- Code examples showing the implementation
- Explanation of why this approach was chosen

## Implementation Details

### Code Changes
The implementation enforces this design decision through:

1. **Conditional ViewModeSelector rendering:**
```typescript
{activeProject && settings.timeManagementSystem === TimeManagementSystem.NONE && (
  <ViewModeSelector ... />
)}
```

2. **Conditional view rendering:**
```typescript
{settings.timeManagementSystem === TimeManagementSystem.NONE && (
  <>
    {activeProject.viewMode === ViewMode.LIST && <TaskList ... />}
    {activeProject.viewMode === ViewMode.BOARD && <TaskBoard ... />}
    {activeProject.viewMode === ViewMode.CALENDAR && <TaskCalendar ... />}
  </>
)}
```

3. **TMS views remain independent:**
```typescript
{settings.timeManagementSystem === TimeManagementSystem.DIT && <DITView ... />}
{settings.timeManagementSystem === TimeManagementSystem.AF4 && <AF4View ... />}
{settings.timeManagementSystem === TimeManagementSystem.FVP && <FVPView ... />}
```

### User Experience Flow

**Scenario 1: Using Standard Mode**
1. User selects TMS = "None"
2. View mode buttons appear in header
3. User can switch between List/Board/Calendar
4. View preference is saved per project

**Scenario 2: Using a TMS**
1. User selects TMS = "DIT" (or AF4, FVP)
2. View mode buttons disappear
3. TMS-specific view is shown
4. View mode preference is preserved (not lost)
5. When switching back to "None", saved view mode is restored

**Scenario 3: Switching Between Modes**
1. User has project in Board view
2. User switches to DIT
3. Board view buttons hidden, DIT view shown
4. User switches back to "None"
5. Board view buttons reappear, Board view restored

## Benefits of This Approach

### 1. Clarity
- Users understand they're either using a TMS or choosing a view mode
- No confusion about which controls apply when

### 2. Simplicity
- Single source of truth for what view to show
- No complex logic to merge TMS and view mode behaviors

### 3. Flexibility
- Each TMS can implement its optimal layout
- Standard views can evolve independently
- Easy to add new TMS or view modes

### 4. Maintainability
- Clear separation of concerns
- Easier to test and debug
- Simpler mental model for developers

## Testing

All existing tests continue to pass (275 tests):
- View mode switching works correctly
- TMS views work correctly
- No interference between the two systems

## Documentation

User-facing documentation updated:
- README.md explains view modes only work in Standard mode
- QUICK_START.md mentions TMS requirement
- VIEW_MODE_TROUBLESHOOTING.md provides debugging steps
- All spec documents reflect the design decision

## Conclusion

The specification documents now accurately reflect the implemented behavior:
- View modes and TMS are mutually exclusive
- Clear rationale provided
- Implementation details documented
- User experience considerations explained

This design decision is now formally documented and can be referenced in future development or when onboarding new team members.
