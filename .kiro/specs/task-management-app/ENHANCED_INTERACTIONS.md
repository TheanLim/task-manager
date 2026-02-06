# Enhanced List and Board View Interactions

## Overview
This document outlines the enhanced interaction requirements for List and Board views, focusing on improved user experience for adding tasks/sections and reordering elements.

## New Requirements Summary

### 1. Task Dialog Integration
**Current**: "+ Add tasks..." and "+ Add task" buttons create tasks with default values
**New**: These buttons should open the Task Dialog modal for full task creation

**Benefits**:
- Consistent task creation experience
- Ability to set all task properties immediately
- Better user experience with validation and feedback

### 2. Inline Section Creation
**Current**: "Add Section" button creates a section with default name "New Section"
**New**: Button converts to inline input field for immediate name entry

**Benefits**:
- Faster workflow - no need to create then rename
- Clearer user intent
- Reduced clicks

### 3. Task Reordering Within Sections (List View)
**Current**: Tasks can only be moved between sections
**New**: Tasks can be reordered within the same section via drag-and-drop

**Benefits**:
- Better task prioritization
- Manual ordering control
- Improved task organization

### 4. Section Reordering
**Current**: Sections have fixed order
**New**: Sections can be reordered via drag-and-drop in both List and Board views

**Benefits**:
- Customizable workflow organization
- Adapt to changing priorities
- Better visual organization

### 5. Inline Section Name Editing in Board View
**Current**: Section names in Board view are not editable
**New**: Click on section name to edit inline

**Benefits**:
- Consistent with List view behavior
- Quick renaming without menus
- Better user experience

## Implementation Tasks

### Task 28.10.1: Update "Add Task" buttons to open Task Dialog
- Modify TaskList "+ Add tasks..." button handler
- Modify TaskBoard "+ Add task" button handler
- Update TaskDialog to accept optional sectionId prop
- Pre-assign sectionId when creating task from section button

### Task 28.10.2: Implement inline "Add Section" input
- Add state for "isAddingSection" in both views
- Convert button to input field on click
- Handle Enter (confirm) and Escape (cancel) keys
- Clear input and hide on completion

### Task 28.10.3: Implement task reordering within sections
- Add drag-over handlers for tasks in List view
- Calculate new order based on drop position
- Update task order field in store
- Provide visual feedback during drag

### Task 28.10.4: Implement section reordering in List view
- Make section containers draggable
- Add drag-over handlers for sections
- Calculate new order based on drop position
- Update section order field in store

### Task 28.10.5: Implement inline section name editing in Board view
- Replace static h3 with InlineEditable component
- Use validateSectionName for validation
- Update section name on save

### Task 28.10.6: Implement section reordering in Board view
- Make section columns draggable
- Add drag-over handlers for sections
- Calculate new order based on drop position
- Update section order field in store

## Technical Considerations

### Drag-and-Drop Library
Continue using @dnd-kit for consistent drag-and-drop behavior:
- Supports both mouse and touch
- Provides accessibility features
- Handles complex drag scenarios

### Order Field Management
- Tasks have `order` field for within-section ordering
- Sections have `order` field for section ordering
- Recalculate orders when items are reordered
- Use incremental values (0, 1, 2, ...) for simplicity

### State Management
- All changes persist to localStorage via Zustand stores
- Optimistic UI updates for smooth experience
- Validation before persisting changes

## User Experience Flow

### Adding a Task
1. User clicks "+ Add tasks..." or "+ Add task"
2. Task Dialog modal opens
3. User fills in task details (description, priority, due date, etc.)
4. User clicks "Create Task"
5. Task appears in the section
6. Modal closes

### Adding a Section
1. User clicks "+ Add Section" or "+ Add section"
2. Button transforms into input field with focus
3. User types section name
4. User presses Enter or clicks Add button
5. Section is created with entered name
6. Input field reverts to button

### Reordering Tasks
1. User drags a task within a section
2. Visual feedback shows drop position
3. User drops task at new position
4. Tasks reorder with smooth animation
5. New order persists

### Reordering Sections
1. User drags a section header (List) or column (Board)
2. Visual feedback shows drop position
3. User drops section at new position
4. Sections reorder with smooth animation
5. New order persists

## Testing Considerations

- Test drag-and-drop on both desktop and mobile
- Test keyboard accessibility for all interactions
- Test validation for section names
- Test persistence of orders across page reloads
- Test edge cases (empty sections, single item, etc.)
