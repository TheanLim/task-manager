# Specification Updates: Inline Editing Feature

**Date**: 2026-02-01  
**Feature**: Inline Editing for Project Names and Task Descriptions  
**Status**: Specification Complete, Ready for Implementation

## Summary

Added inline editing functionality to enable quick editing of project names and task descriptions directly by clicking on them, without opening dialogs or sidebars. This improves the editing workflow and reduces UI clutter.

## Changes Made

### 1. Requirements Document (`requirements.md`)

**Added: Requirement 20 - Inline Editing**

New user story and 10 acceptance criteria covering:
- Click-to-edit for project names in header
- Click-to-edit for task descriptions in all views
- Save on Enter or blur (click outside)
- Cancel on Escape
- Validation for empty values
- Validation for max length
- Visual feedback during editing
- Independent editing state per field
- Prevention of other interactions during edit

**Location**: After Requirement 19 (Project Routing), before Requirement 18 (Future Extensibility)

### 2. Design Document (`design.md`)

**Added: Inline Editing Architecture Section**

New design section covering:
- Design decision rationale (faster workflow, less clutter)
- Implementation pattern with complete code example
- InlineEditable component interface and implementation
- Usage examples for project names and task descriptions
- Validation integration with existing validation functions
- Visual design specifications (display mode, edit mode, keyboard shortcuts)
- Accessibility considerations
- Edge cases handling
- Benefits and trade-offs analysis

**Location**: After "Project Routing Architecture" section

**Key Design Decisions**:
- Controlled input pattern with local state
- Reuse existing validation functions
- Auto-focus and select all on edit
- Save on Enter or blur, cancel on Escape
- Clear visual feedback for edit mode and errors

### 3. Tasks Document (`tasks.md`)

**Added: Task 27 - Implement Inline Editing for Projects and Tasks**

New implementation task with 5 subtasks:
- 27.1: Create InlineEditable component (9 steps)
- 27.2: Integrate for project names (4 steps)
- 27.3: Integrate for task descriptions in all views (9 steps)
- 27.4: Write unit tests (9 test scenarios) - Optional
- 27.5: Write integration tests (5 test scenarios) - Optional

**Renumbered**: Tasks 27-31 → Tasks 28-32 to accommodate new task

**Location**: After Task 26 (Project Routing), before Checkpoint

## Implementation Approach

### Component Pattern

**InlineEditable Component**:
- Props: `value`, `onSave`, `validate`, `placeholder`, `className`
- State: `isEditing`, `editValue`, `error`
- Modes: Display mode (click to edit) and Edit mode (input field)
- Keyboard: Enter saves, Escape cancels
- Blur: Saves changes when clicking outside

### Integration Points

1. **Project Name** (app/page.tsx header):
   ```typescript
   <InlineEditable
     value={project.name}
     onSave={(newName) => updateProject(project.id, { name: newName })}
     validate={validateProjectName}
   />
   ```

2. **Task Descriptions** (all task views):
   ```typescript
   <InlineEditable
     value={task.description}
     onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
     validate={validateTaskDescription}
   />
   ```

### Views to Update

- TaskList (list view)
- TaskBoard (board view)
- TaskCalendar (calendar view)
- DITView (Do It Tomorrow)
- AF4View (Autofocus 4)
- FVPView (Final Version Perfected)
- Project header (app/page.tsx)

## Requirements Traceability

### New Requirement Coverage

**Requirement 20: Inline Editing**
- 20.1: Click project name to edit → Task 27.2
- 20.2: Click task description to edit → Task 27.3
- 20.3: Save on Enter/blur → Task 27.1
- 20.4: Save task on Enter/blur → Task 27.1
- 20.5: Cancel on Escape → Task 27.1
- 20.6: Validate empty values → Task 27.1
- 20.7: Validate max length → Task 27.1
- 20.8: Visual feedback → Task 27.1
- 20.9: Independent state → Task 27.1
- 20.10: Prevent other interactions → Task 27.1

### Related Requirements

**Requirement 1: Project Management**
- 1.3: Edit project name → Enhanced with inline editing

**Requirement 2: Task Management**
- 2.3: Edit task properties → Enhanced with inline editing for descriptions

## Testing Strategy

### Unit Tests (Task 27.4 - Optional)

1. **Display mode**:
   - Renders value correctly
   - Shows placeholder when empty
   - Activates edit mode on click

2. **Edit mode**:
   - Auto-focuses input
   - Selects all text
   - Updates value on change

3. **Keyboard shortcuts**:
   - Enter saves changes
   - Escape cancels changes
   - Tab behavior (future)

4. **Validation**:
   - Empty value shows error
   - Max length shows error
   - Valid value saves successfully

5. **Blur behavior**:
   - Saves changes on blur
   - Doesn't save if validation fails

### Integration Tests (Task 27.5 - Optional)

1. Edit project name in header
2. Edit task description in list view
3. Edit task description in board view
4. Validation errors prevent save
5. Changes persist to localStorage

### Manual Testing Checklist

- [ ] Click project name → Edit mode activates
- [ ] Type new name → Press Enter → Saves
- [ ] Type new name → Press Escape → Cancels
- [ ] Type new name → Click outside → Saves
- [ ] Try empty name → Shows error
- [ ] Try too long name → Shows error
- [ ] Click task description → Edit mode activates
- [ ] Edit task in list view → Saves
- [ ] Edit task in board view → Saves
- [ ] Edit task in calendar view → Saves
- [ ] Edit task in DIT view → Saves
- [ ] Edit task in AF4 view → Saves
- [ ] Edit task in FVP view → Saves

## Visual Design Specifications

### Display Mode
- Subtle hover effect (light background or underline)
- Cursor: text cursor on hover
- Tooltip: "Click to edit"
- No border in display mode

### Edit Mode
- Input field with border (primary color)
- Auto-focus with text selected
- Clear visual distinction from display
- Error message below input (red text)
- Same font size and style as display

### States
- **Normal**: Default appearance
- **Hover**: Subtle background change
- **Focus**: Border highlight
- **Error**: Red border + error message
- **Disabled**: Grayed out (future)

## Accessibility

- ARIA label: "Click to edit [field name]"
- ARIA live region for error announcements
- Keyboard navigation (Enter, Escape)
- Focus management (auto-focus on edit)
- Screen reader announcements for mode changes

## Edge Cases

1. **Concurrent edits**: Only one field editable at a time
2. **Empty values**: Prevented by validation
3. **Long text**: Input scrolls horizontally
4. **Special characters**: Allowed (no sanitization)
5. **Rapid clicks**: Prevent multiple activations
6. **Network issues**: N/A (local storage only)
7. **Undo/Redo**: Not implemented (future enhancement)

## Benefits

✅ **Faster workflow**: No dialog opening/closing  
✅ **Less UI clutter**: Inline editing reduces modals  
✅ **Familiar pattern**: Used in Asana, Todoist, etc.  
✅ **Maintains validation**: Same validation as dialogs  
✅ **Clear feedback**: Visual states for edit/error  
✅ **Keyboard accessible**: Enter/Escape shortcuts  
✅ **Backward compatible**: Dialogs still available for multi-field edits

## Trade-offs

⚠️ **Single-field only**: Can't edit multiple properties at once  
⚠️ **Focus management**: Requires careful handling  
⚠️ **Discoverability**: May be less obvious than "Edit" buttons

**Mitigation**:
- Keep dialogs for editing multiple properties
- Add hover effects and tooltips for discoverability
- Provide clear visual feedback during editing

## Implementation Estimate

- **Component creation**: 2-3 hours
- **Integration (7 views)**: 3-4 hours
- **Testing**: 2-3 hours
- **Total**: 7-10 hours

## Dependencies

- Existing validation functions (already implemented)
- Zustand stores (already implemented)
- No new npm packages required

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing dialogs remain functional
- No data model changes
- No breaking changes to existing components
- Purely additive feature

## Future Enhancements

Potential improvements for future versions:

1. **Multi-line editing**: Use textarea for long descriptions
2. **Rich text editing**: Add formatting (bold, italic, links)
3. **Undo/Redo**: Add edit history
4. **Tab navigation**: Tab to next editable field
5. **Inline editing for other fields**: Priority, due date, tags
6. **Batch editing**: Edit multiple items at once
7. **Auto-save**: Save as you type (with debounce)

## Next Steps

1. ✅ **COMPLETE**: Update specification documents (requirements, design, tasks)
2. **TODO**: Implement Task 27.1 - Create InlineEditable component
3. **TODO**: Implement Task 27.2 - Integrate for project names
4. **TODO**: Implement Task 27.3 - Integrate for task descriptions
5. **TODO**: Test inline editing in all views
6. **TODO**: Run full test suite
7. **TODO**: Update user documentation if needed

## Notes

- This feature enhances the existing editing workflow without replacing dialogs
- Dialogs remain useful for editing multiple properties at once
- Inline editing is optimized for quick name/description changes
- Implementation is straightforward with clear patterns
- No new dependencies required
- Estimated completion: 1-2 days

## References

- requirements.md - Requirement 20
- design.md - Inline Editing Architecture section
- tasks.md - Task 27
- Existing validation functions in lib/validation.ts
