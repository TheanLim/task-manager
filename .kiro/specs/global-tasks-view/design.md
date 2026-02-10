# Design Document: Global Tasks View

## Overview

The Global Tasks View feature adds a unified view of all tasks across all projects in the task management application. This view will be accessible from a new "Tasks" section in the sidebar, positioned above the Projects section. The implementation will **heavily reuse** existing components (TaskList, TaskRow) with minimal modifications, following the established patterns in the codebase.

The design follows the existing application architecture:
- React components with TypeScript
- Zustand stores for state management (dataStore, appStore, tmsStore)
- Existing UI component library (shadcn/ui)
- Consistent styling with Tailwind CSS
- URL-based navigation with query parameters

## Architecture

### Component Hierarchy

```
Layout (existing)
├── Sidebar (existing)
│   ├── TasksSection (NEW - minimal addition)
│   ├── Separator (NEW - horizontal line)
│   └── ProjectList (existing)
└── Main Content Area (existing)
    └── GlobalTasksView (NEW - thin wrapper)
        ├── GlobalTasksHeader (NEW - simple header)
        │   ├── ViewModeToggle (nested/flat)
        │   ├── Add Unlinked Task button
        │   └── FilterControls (NEW - reuses FilterPanel pattern)
        └── TaskList (REUSED - add showProjectColumn prop)
            └── TaskRow (REUSED - add projectName prop)
```

### Data Flow

1. **Global State**: Zustand stores (dataStore, appStore, tmsStore) remain the single source of truth
2. **View State**: GlobalTasksView maintains minimal local UI state (filters, display mode)
3. **Task Operations**: All task mutations go through existing store actions (no new actions needed)
4. **Navigation**: URL query parameters track active view (?view=tasks vs ?project=X)

### Routing Strategy

The application uses URL-based routing with query parameters (existing pattern):
- Global tasks view: `/?view=tasks`
- With filters: `/?view=tasks&project=abc&priority=high`
- Project view: `/?project=abc&tab=list` (existing)
- Task detail: `/?view=tasks&task=xyz` (existing pattern)

## Components and Interfaces

### 1. GlobalTasksView Component

**Purpose**: Thin wrapper that aggregates tasks from all projects and passes them to existing TaskList

**Props**:
```typescript
interface GlobalTasksViewProps {
  // No props - reads from stores
}
```

**State**:
```typescript
interface GlobalTasksViewState {
  displayMode: 'nested' | 'flat';
  filters: TaskFilters;
}

interface TaskFilters {
  projectIds: UUID[]; // Empty = show all
  completed: boolean | null; // null = show all, true = completed only, false = incomplete only
  priorities: Priority[];
  assignees: string[];
  tags: string[];
}
```

**Behavior**:
- Fetches ALL tasks from dataStore (tasks.filter() to get all)
- Applies filters (simple array filtering)
- Groups tasks by project for display
- Passes filtered tasks to existing TaskList component with `showProjectColumn={true}`
- Persists displayMode to appStore (new field)
- Manages filter state locally (useState)

### 2. GlobalTasksHeader Component

**Purpose**: Simple header with display mode toggle and add task button

**Props**:
```typescript
interface GlobalTasksHeaderProps {
  displayMode: 'nested' | 'flat';
  onDisplayModeChange: (mode: 'nested' | 'flat') => void;
  onAddUnlinkedTask: () => void;
}
```

**Behavior**:
- Renders display mode toggle button (nested/flat)
- Renders "Add Task" button for unlinked tasks
- Minimal styling, follows existing header patterns

### 3. TaskFilterPanel Component (Optional for MVP)

**Purpose**: Simple filter controls (can reuse existing FilterPanel pattern)

**Props**:
```typescript
interface TaskFilterPanelProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  availableProjects: Project[];
}
```

**Behavior**:
- Multi-select for projects (shadcn/ui Select component)
- Tri-state for completion (all/completed/incomplete)
- Multi-select for priorities
- "Clear All" button
- Can be added later if needed for MVP

### 4. TaskList Modifications (Minimal Changes)

**Existing Component**: Reuse with ONE new prop

**New Props**:
```typescript
interface TaskListProps {
  // ... existing props
  showProjectColumn?: boolean; // NEW - default false
}
```

**Modifications**:
- When `showProjectColumn` is true, add Project column to table header
- Pass `showProjectColumn` to TaskRow components
- NO changes to drag-drop logic (works within same project only)
- NO changes to section grouping (sections are project-specific)
- Display tasks grouped by project when in global view

### 5. TaskRow Modifications (Minimal Changes)

**Existing Component**: Reuse with ONE new prop

**New Props**:
```typescript
interface TaskRowProps {
  // ... existing props
  projectName?: string; // NEW - only passed when showProjectColumn is true
}
```

**Modifications**:
- When `projectName` is provided, render it in the Project column
- Render "No Project" if task.projectId is null
- NO other changes needed

### 6. SidebarTasksSection Component (New, Simple)

**Purpose**: Clickable "Tasks" item in sidebar

**Props**:
```typescript
interface SidebarTasksSectionProps {
  isActive: boolean;
  onClick: () => void;
}
```

**Behavior**:
- Renders "Tasks" label with icon (similar to project items)
- Highlights when active (reuse existing styles)
- Navigates to `/?view=tasks` on click

## Data Models

### Extended Task Model (Minimal Change)

The existing Task interface already supports unlinked tasks:
```typescript
export interface Task {
  id: UUID;
  projectId: UUID; // Can be null for unlinked tasks
  parentTaskId: UUID | null;
  sectionId: UUID | null;
  // ... other fields
}
```

**Required Change**: Update Task type to allow `projectId: UUID | null`

### Extended AppStore

Add minimal fields to existing appStore:

```typescript
interface AppStore {
  // ... existing fields
  globalTasksDisplayMode: 'nested' | 'flat'; // NEW
  
  setGlobalTasksDisplayMode: (mode: 'nested' | 'flat') => void; // NEW
}
```

**Note**: No need for `activeView` field - we can determine this from URL query params

### Filter Persistence (Optional for MVP)

Filters can be stored in localStorage if needed:
```typescript
interface GlobalTasksViewPreferences {
  displayMode: 'nested' | 'flat';
  lastFilters?: TaskFilters;
}
```

Store in localStorage key: `'global-tasks-preferences'`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Complete Task Display

*For any* set of projects and tasks in the dataStore, the Global_Tasks_View should display all tasks from all projects, including tasks with null projectId.

**Validates: Requirements 2.5**

### Property 2: Project Column Display

*For any* task displayed in Global_Tasks_View, if the task has a projectId, the project name should be displayed in the Project column; if projectId is null, "No Project" should be displayed.

**Validates: Requirements 2.3, 2.4**

### Property 3: Display Mode Persistence

*For any* display mode selection (nested or flat), when the application is reloaded, the display mode should be restored from appStore.

**Validates: Requirements 3.5**

### Property 4: Unlinked Task Creation

*For any* task created through the Global_Tasks_View "Add Task" button, the task's projectId should be null.

**Validates: Requirements 4.2**

### Property 5: Task Completion Consistency

*For any* task marked as complete in the Global_Tasks_View, the task should also appear as complete when viewed in its project view (if it has a project).

**Validates: Requirements 5.2, 8.1, 8.2**

### Property 6: Filter Application

*For any* combination of active filters (project, completion status, priority), the displayed tasks should match ALL active filter criteria.

**Validates: Requirements 6.7**

### Property 7: Cross-View Data Consistency

*For any* task modification (create, update, delete) performed in Global_Tasks_View, the change should be immediately reflected in the dataStore and visible in project views.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

## Error Handling

### Invalid Task Operations

**Scenario**: User attempts to create a task with empty description
- **Handling**: Existing TaskDialog validation prevents this
- **Recovery**: Show validation error, keep dialog open

**Scenario**: User attempts to access global view with no tasks
- **Handling**: Display empty state message: "No tasks yet. Create a task to get started."
- **Recovery**: Show "Add Task" button

### Filter Edge Cases

**Scenario**: All filters result in zero tasks
- **Handling**: Display "No tasks match the current filters" message
- **Recovery**: Provide "Clear Filters" button (if filters implemented)

**Scenario**: Invalid project ID in filter (project was deleted)
- **Handling**: Skip invalid project IDs when filtering
- **Recovery**: Continue displaying other filtered tasks

### Navigation Edge Cases

**Scenario**: User navigates to `/?view=tasks` with no tasks in system
- **Handling**: Display empty state with "Add Task" button
- **Recovery**: Allow creating unlinked task

**Scenario**: User has `/?view=tasks&task=xyz` but task was deleted
- **Handling**: Close task detail panel, show global tasks list
- **Recovery**: Clear task parameter from URL
- **Handling**: Implement virtualization to render only visible tasks
- **Recovery**: Maintain smooth scrolling and interaction

**Scenario**: Complex filter/sort operations take too long
- **Handling**: Show loading indicator for operations >100ms
- **Recovery**: Allow user to cancel long-running operations

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** will focus on:
- Component rendering (GlobalTasksView, GlobalTasksHeader, sidebar section)
- User interactions (clicking buttons, toggling modes, filtering)
- Edge cases (empty states, no projects, single task)
- Integration with existing components (TaskList, TaskRow)

**Property-Based Tests** will focus on:
- Universal properties that hold for all inputs
- Data consistency across operations
- Filter correctness with random data
- Display mode behavior with various task configurations

### Property-Based Testing Configuration

- **Library**: fast-check (TypeScript property-based testing library)
- **Iterations**: Minimum 100 iterations per property test
- **Test Organization**: Each correctness property maps to one property-based test
- **Tagging**: Each test tagged with `Feature: global-tasks-view, Property N: [property text]`

### Test Coverage Areas

#### Component Tests (Unit)
- GlobalTasksView renders correctly with various task sets
- GlobalTasksHeader controls work correctly
- Sidebar navigation works correctly
- Display mode toggle works correctly
- Task creation from global view works
- Empty states display correctly

#### Integration Tests (Unit)
- Task modifications in global view update dataStore
- Task modifications in project view visible in global view
- TaskList receives correct props when in global view
- TaskRow displays project name correctly
- URL navigation works correctly

#### Property Tests (Property-Based)
- Property 1: Complete task display (generate random projects/tasks)
- Property 2: Project column display (generate random tasks with/without projectId)
- Property 3: Display mode persistence (generate random mode selections)
- Property 4: Unlinked task creation (generate random task data)
- Property 5: Task completion consistency (generate random tasks and completions)
- Property 6: Filter application (generate random filters and tasks)
- Property 7: Cross-view consistency (generate random operations)

### Testing Tools

- **Unit Testing**: Vitest + React Testing Library (already configured)
- **Property Testing**: fast-check (needs to be added to dependencies)
- **Component Testing**: @testing-library/react (already in dependencies)
- **User Interaction**: @testing-library/user-event (already in dependencies)

### Test Data Generation

For property-based tests, we'll create generators for:
- Random projects with varying properties
- Random tasks with all field variations (including null projectId)
- Random task hierarchies (parent-child relationships)
- Random filter combinations

### Continuous Testing

- All tests run on every commit
- Property tests run with 100 iterations in CI
- Integration tests run before deployment
