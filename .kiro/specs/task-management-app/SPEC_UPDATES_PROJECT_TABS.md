# Specification Updates: Project Tabs and Overview

## Overview

This document describes the addition of a tabbed interface for project pages, including an Overview tab for project management and collapsible sections in the List view that map to Board columns.

## New Requirements

### Requirement 21: Project Tabs and Overview

**User Story:** As a user, I want to navigate between different views of a project using tabs, and have an overview page where I can edit project details and manage the project.

**Key Features:**
- Tabbed interface with Overview, List, Board, and Calendar tabs
- URL-based tab navigation (e.g., `/?project=abc-123&tab=list`)
- Tab state persistence per project
- Overview tab with project details and danger zone
- Project description editing
- Project deletion with confirmation

### Requirement 22: Collapsible Sections in List View

**User Story:** As a user, I want to organize tasks into collapsible sections in the list view, with default sections that map to board columns.

**Key Features:**
- Collapsible sections (expanded by default)
- Default sections: "To Do", "Doing", "Done"
- Section-column mapping (unified data model)
- Add/rename/delete sections
- Collapsed state persistence
- Task count display in section headers

## Design Changes

### 1. Unified Section/Column Model

**Breaking Change:** Columns are removed in favor of a unified Section model.

**Before:**
```typescript
interface Section {
  id: UUID;
  projectId: UUID;
  name: string;
  order: number;
}

interface Column {
  id: UUID;
  projectId: UUID;
  name: string;
  order: number;
}

interface Task {
  sectionId: UUID | null;  // For List view
  columnId: UUID | null;   // For Board view
}
```

**After:**
```typescript
interface Section {
  id: UUID;
  projectId: UUID;
  name: string;
  order: number;
  collapsed: boolean;  // New field for List view state
}

// Column interface removed

interface Task {
  sectionId: UUID | null;  // Used by both List and Board views
  // columnId removed
}
```

**Rationale:**
- Sections and columns represent the same concept (task groupings)
- Eliminates synchronization issues
- Simpler mental model for users
- Single source of truth

### 2. Project Page Structure

**Before:**
```
Project Page
├── Header (project name, view mode selector, buttons)
└── Content (List/Board/Calendar based on viewMode)
```

**After:**
```
Project Page
├── Header (project name, buttons)
└── Tabs
    ├── Overview Tab
    │   ├── Project Details
    │   └── Danger Zone
    ├── List Tab (collapsible sections)
    ├── Board Tab (sections as columns)
    └── Calendar Tab
```

### 3. URL Structure

**New URL Parameters:**
- `/?project=<id>` - Defaults to Overview tab
- `/?project=<id>&tab=overview` - Overview tab (explicit)
- `/?project=<id>&tab=list` - List view
- `/?project=<id>&tab=board` - Board view
- `/?project=<id>&tab=calendar` - Calendar view

### 4. Default Sections

When creating a new project, the system automatically creates three default sections:

1. **To Do** (order: 0, collapsed: false)
2. **Doing** (order: 1, collapsed: false)
3. **Done** (order: 2, collapsed: false)

These provide immediate structure and map naturally to a typical workflow.

## Implementation Tasks

### Task 28: Implement Project Tabs and Overview

**Subtasks:**
1. Update data model (remove Column, add collapsed to Section)
2. Migrate data store (remove column actions, update task operations)
3. Create default sections for new projects
4. Implement tab routing with URL parameters
5. Create ProjectTabs component
6. Create ProjectOverview component
7. Update TaskList for collapsible sections
8. Update TaskBoard to use sections
9. Integrate tabs into project page
10. Write unit tests
11. Write integration tests

**Estimated Complexity:** High (breaking changes to data model)

## Migration Strategy

### For Existing Data

If the app already has data with columns:

1. **Data Migration Script:**
   ```typescript
   function migrateColumnsToSections() {
     const { columns, tasks } = useDataStore.getState();
     
     // Convert columns to sections
     columns.forEach(column => {
       addSection({
         id: column.id,
         projectId: column.projectId,
         name: column.name,
         order: column.order,
         collapsed: false,
         createdAt: column.createdAt,
         updatedAt: column.updatedAt,
       });
     });
     
     // Update tasks to use sectionId
     tasks.forEach(task => {
       if (task.columnId) {
         updateTask(task.id, {
           sectionId: task.columnId,
           columnId: undefined,
         });
       }
     });
     
     // Clear columns
     // (columns will be removed from data model)
   }
   ```

2. **Version Detection:**
   - Check localStorage for version number
   - If version < 2.0, run migration
   - Update version to 2.0

### For New Projects

- No migration needed
- Default sections created automatically
- Clean data model from the start

## Benefits

### User Benefits
- ✅ Clearer project organization
- ✅ Dedicated space for project management
- ✅ Easier to find project details
- ✅ Collapsible sections reduce clutter
- ✅ Consistent experience between List and Board views

### Developer Benefits
- ✅ Simpler data model
- ✅ No synchronization issues
- ✅ Easier to maintain
- ✅ More extensible (can add more tabs)
- ✅ Better separation of concerns

## Testing Strategy

### Unit Tests
- ProjectTabs component (tab switching)
- ProjectOverview component (display, edit, delete)
- Collapsible section toggle
- Section CRUD operations

### Integration Tests
- Tab navigation updates URL
- Tab state persists across reloads
- Section collapse state persists
- Section-board synchronization
- Project deletion from overview

### Manual Testing
- Create new project → verify default sections
- Toggle sections → verify state persists
- Switch tabs → verify content changes
- Edit project description → verify saves
- Delete project → verify confirmation and redirect
- Move task between sections in List → verify appears in Board
- Rename section in List → verify updates in Board

## Rollout Plan

1. **Phase 1: Data Model Update**
   - Update types
   - Update stores
   - Run migration for existing data

2. **Phase 2: UI Components**
   - Create ProjectTabs
   - Create ProjectOverview
   - Update TaskList
   - Update TaskBoard

3. **Phase 3: Integration**
   - Integrate tabs into project page
   - Update routing
   - Test thoroughly

4. **Phase 4: Polish**
   - Add animations
   - Improve accessibility
   - Write documentation

## Open Questions

1. **Should we support custom tab order?**
   - Decision: No, keep fixed order for simplicity

2. **Should collapsed state be per-user or per-project?**
   - Decision: Per-project (stored in Section model)

3. **What happens to tasks when a section is deleted?**
   - Decision: Move to first section (To Do)

4. **Should we allow renaming default sections?**
   - Decision: Yes, they're just regular sections

5. **Should we show task count when section is collapsed?**
   - Decision: Yes, in the section header badge

## Related Requirements

- Requirement 1: Project Management (project deletion)
- Requirement 4: Sections and Columns (unified model)
- Requirement 6: Multiple View Modes (now tabs)
- Requirement 19: Project Routing (tab parameter)
- Requirement 20: Inline Editing (project description)

## Success Criteria

- ✅ All existing tests pass
- ✅ New tests cover tab and section functionality
- ✅ Data migration works for existing projects
- ✅ No data loss during migration
- ✅ UI is intuitive and responsive
- ✅ Performance is not degraded
- ✅ Static export still works
