# Design Document: Global Tasks TMS Integration

## Overview

This design extends Time Management System (TMS) functionality to the global tasks view. Currently, TMS views (DIT, AF4, FVP) only work in project-specific contexts. This feature enables users to apply TMS methodologies across all tasks from all projects in the global view.

The design reuses existing TMS components (DITView, AF4View, FVPView) with minimal modifications, ensuring consistency and maintainability. The key challenge is handling tasks from multiple projects while maintaining the same TMS behavior and user experience.

## Architecture

### High-Level Structure

```
Global Tasks View
├── GlobalTasksHeader (with TMS Selector)
├── Conditional Rendering:
│   ├── TMS Active (DIT/AF4/FVP)
│   │   └── Respective TMS View Component
│   │       └── Tasks from all projects
│   └── TMS None
│       └── Standard GlobalTasksView
│           └── Table with nested/flat toggle
```

### Component Hierarchy

```
app/page.tsx (Global View Section)
├── GlobalTasksHeader
│   ├── TMS Selector (NEW)
│   ├── Display Mode Toggle (conditional)
│   └── Add Task Button
└── Conditional Content:
    ├── DITView (when TMS = DIT)
    ├── AF4View (when TMS = AF4)
    ├── FVPView (when TMS = FVP)
    └── GlobalTasksView (when TMS = NONE)
```

### Data Flow

1. **TMS Selection**: User selects TMS via TMSSelector → Updates appStore.settings.timeManagementSystem
2. **View Rendering**: app/page.tsx checks settings.timeManagementSystem → Renders appropriate view
3. **TMS Actions**: User interacts with TMS view → Updates tmsStore state
4. **State Persistence**: tmsStore persists globally → Available in all views

## Components and Interfaces

### Modified Components

#### 1. GlobalTasksHeader

**Current State:**
- Displays "All Tasks" title
- Has nested/flat display mode toggle
- Has "Add Task" button

**Modifications:**
```typescript
interface GlobalTasksHeaderProps {
  onAddTask: () => void;
  showTMSSelector: boolean; // NEW
  showDisplayModeToggle: boolean; // NEW
}
```

**Behavior:**
- Add TMSSelector component
- Conditionally show display mode toggle (only when TMS = NONE)
- TMSSelector uses same component as project views

#### 2. app/page.tsx (Global View Section)

**Current State:**
- Renders GlobalTasksHeader
- Renders GlobalTasksView unconditionally

**Modifications:**
```typescript
// In global view section
{isGlobalView ? (
  <>
    <GlobalTasksHeader 
      onAddTask={() => handleNewTask()}
      showTMSSelector={true}
      showDisplayModeToggle={settings.timeManagementSystem === TimeManagementSystem.NONE}
    />
    
    <div className="flex-1 overflow-auto">
      {settings.timeManagementSystem === TimeManagementSystem.DIT && (
        <DITView
          tasks={allTasks}
          onTaskClick={handleTaskClick}
          onTaskComplete={handleTaskComplete}
        />
      )}
      
      {settings.timeManagementSystem === TimeManagementSystem.AF4 && (
        <AF4View
          tasks={allTasks}
          onTaskClick={handleTaskClick}
          onTaskComplete={handleTaskComplete}
        />
      )}
      
      {settings.timeManagementSystem === TimeManagementSystem.FVP && (
        <FVPView
          tasks={allTasks}
          onTaskClick={handleTaskClick}
          onTaskComplete={handleTaskComplete}
        />
      )}
      
      {settings.timeManagementSystem === TimeManagementSystem.NONE && (
        <GlobalTasksView
          onTaskClick={handleTaskClick}
          onTaskComplete={handleTaskComplete}
          onAddTask={() => handleNewTask()}
          onViewSubtasks={handleTaskClick}
          onSubtaskButtonClick={handleSubtaskButtonClick}
          onAddSubtask={(parentTaskId) => handleNewTask(undefined, parentTaskId)}
          selectedTaskId={selectedTaskId}
          onProjectClick={(projectId) => router.push(`/?project=${projectId}&tab=list`)}
        />
      )}
    </div>
  </>
) : ...}
```

### Enhanced TMS Components

The existing TMS components (DITView, AF4View, FVPView) need minor enhancements to display project information when used in global context.

#### Enhancement Strategy

**Option 1: Props-based (Recommended)**
- Add optional `showProjectInfo?: boolean` prop to each TMS view
- When true, display project badge/link next to task description
- Minimal changes to existing components

**Option 2: Wrapper Component**
- Create GlobalDITView, GlobalAF4View, GlobalFVPView wrappers
- Wrappers enhance task rendering with project info
- More code but cleaner separation

**Selected Approach: Option 1** (simpler, less duplication)

#### Modified TMS View Interface

```typescript
interface DITViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  showProjectInfo?: boolean; // NEW - default false
  onProjectClick?: (projectId: string) => void; // NEW - for project navigation
}

// Same for AF4ViewProps and FVPViewProps
```

#### Task Rendering Enhancement

Each TMS view's `renderTask` function will be enhanced:

```typescript
const renderTask = (task: Task, ...otherParams) => {
  const project = showProjectInfo && task.projectId 
    ? projects.find(p => p.id === task.projectId) 
    : null;
    
  return (
    <Card>
      <div className="flex items-start gap-3">
        {/* Existing task rendering */}
        <Checkbox ... />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span>{task.description}</span>
            
            {/* NEW: Project badge */}
            {showProjectInfo && (
              <Badge 
                variant="outline" 
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.projectId && onProjectClick) {
                    onProjectClick(task.projectId);
                  }
                }}
              >
                {project?.name || 'No Project'}
              </Badge>
            )}
            
            {/* Existing priority badge */}
            {task.priority !== 'none' && <Badge>...</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );
};
```

## Data Models

### Existing Models (No Changes)

The existing data models remain unchanged:

```typescript
// TMS State (already global)
interface TMSState {
  activeSystem: TimeManagementSystem;
  dit: {
    todayTasks: UUID[];      // Task IDs from any project
    tomorrowTasks: UUID[];   // Task IDs from any project
    lastDayChange: ISODateString;
  };
  af4: {
    markedTasks: UUID[];     // Task IDs from any project
    markedOrder: UUID[];     // Order of marking
  };
  fvp: {
    dottedTasks: UUID[];     // Task IDs from any project
    currentX: UUID | null;
    selectionInProgress: boolean;
  };
}

// App Settings (already has TMS setting)
interface AppSettings {
  activeProjectId: UUID | null;
  timeManagementSystem: TimeManagementSystem; // Global setting
  showOnlyActionableTasks: boolean;
  theme: 'light' | 'dark' | 'system';
  globalTasksDisplayMode: 'nested' | 'flat'; // Existing
}
```

### Key Design Decision: Global TMS State

The TMS state is **already global** in the current implementation. The `tmsStore` doesn't have project-specific scoping. This means:

✅ **Advantages:**
- No data model changes needed
- TMS metadata automatically works across views
- Simpler implementation
- Consistent behavior between global and project views

⚠️ **Implications:**
- TMS organization applies to ALL tasks regardless of which view you're in
- If you mark a task in AF4 in project view, it's marked in global view too
- This is actually the desired behavior per requirements

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection Analysis

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **TMS View Rendering**: Requirements 1.2, 2.1, 3.1, 4.1, 6.1 all test that the correct view renders for a given TMS selection. These can be combined into one comprehensive property.

2. **Project Information Display**: Requirements 2.6, 3.6, 4.6, 7.1, 7.4 all test that project information is displayed in TMS views. These can be combined.

3. **Task Visibility**: Requirements 2.5, 3.5, 4.2, 4.5 all test that tasks from all projects are available in TMS views. These overlap significantly.

4. **TMS Metadata Operations**: Requirements 2.2, 2.3, 3.2, 4.3 all test that TMS operations work regardless of project. These can be combined into one property about project-agnostic operations.

5. **View Consistency**: Requirements 5.2, 5.3, 9.1, 9.2, 9.3, 9.5 all test that TMS state is consistent across views. These can be combined.

6. **Display Mode Toggle**: Requirements 6.3, 6.4 both test toggle visibility based on TMS setting. These can be combined.

The following properties represent the minimal set needed for comprehensive coverage:

### Property 1: TMS View Rendering

*For any* time management system selection (DIT, AF4, FVP, or NONE), when in global tasks view, the system should render exactly one view component corresponding to that selection, and that component should be the correct type (DITView for DIT, AF4View for AF4, FVPView for FVP, GlobalTasksView for NONE).

**Validates: Requirements 1.2, 1.3, 2.1, 3.1, 4.1, 6.1, 6.2**

### Property 2: TMS Operations Project-Agnostic

*For any* task (regardless of its project ID or lack thereof) and any TMS operation (moving to today/tomorrow, marking/unmarking, dotting), the operation should succeed and update the global TMS metadata correctly.

**Validates: Requirements 2.2, 2.3, 3.2, 4.3**

### Property 3: Task Visibility Across Projects

*For any* TMS view (DIT, AF4, FVP) in global context and any set of tasks from multiple projects, all non-completed tasks should be visible and available for TMS operations in their appropriate categories (scheduled/unscheduled for DIT, marked/unmarked for AF4, dotted/undotted for FVP).

**Validates: Requirements 2.5, 3.5, 4.2, 4.5, 8.2**

### Property 4: Project Information Display

*For any* task displayed in any TMS view (DIT, AF4, FVP) in global context, the system should display the project name if the task has a project ID, or display "No Project" indicator if the task has no project ID, and this display should be consistent across all three TMS views.

**Validates: Requirements 2.6, 3.6, 4.6, 7.1, 7.2, 7.4**

### Property 5: TMS State Consistency Across Views

*For any* TMS metadata operation performed in any view (global or project), the resulting TMS state should be identical regardless of which view the operation was performed in, and the state should be immediately reflected in all views.

**Validates: Requirements 5.2, 5.3, 9.1, 9.2, 9.3, 9.5**

### Property 6: Display Mode Toggle Visibility

*For any* TMS setting, the nested/flat display mode toggle should be visible if and only if the TMS is set to NONE, and the toggle should be hidden for all other TMS values (DIT, AF4, FVP).

**Validates: Requirements 6.3, 6.4**

### Property 7: TMS State Persistence

*For any* TMS metadata change, after a page reload or browser session restart, the TMS state should be identical to the state before the reload.

**Validates: Requirements 5.5**

### Property 8: Display Mode Preservation

*For any* sequence of TMS switches (NONE → TMS → NONE), the nested/flat display mode setting should remain unchanged from its value before the first switch.

**Validates: Requirements 6.5**

### Property 9: AF4 Mark Order Preservation

*For any* sequence of task marking operations in AF4, the marked tasks list should maintain the exact order in which tasks were marked, regardless of the tasks' projects or other properties.

**Validates: Requirements 3.4**

### Property 10: FVP Dotted Task Order

*For any* completed FVP selection process, the dotted tasks should be displayed in reverse order from the order they were selected (working order).

**Validates: Requirements 4.4**

### Property 11: TMS Metadata Clearing

*For any* TMS system switch operation, all TMS metadata (today/tomorrow lists, marked tasks, dotted tasks) should be cleared before activating the new system.

**Validates: Requirements 5.4**

### Property 12: Project Navigation

*For any* task with a project ID displayed in a TMS view, clicking the project badge should navigate to that project's list view.

**Validates: Requirements 7.3**

### Property 13: Component Backward Compatibility

*For any* existing TMS component functionality (task completion, drag-and-drop, marking, comparison), the functionality should work identically when the component receives tasks from multiple projects versus tasks from a single project.

**Validates: Requirements 8.3, 8.4**

## Error Handling

### Error Scenarios

1. **Missing Project Data**
   - **Scenario**: Task has projectId but project doesn't exist
   - **Handling**: Display "Unknown Project" badge, log warning
   - **Recovery**: Allow task operations to continue normally

2. **Invalid TMS State**
   - **Scenario**: TMS metadata references non-existent task IDs
   - **Handling**: Filter out invalid IDs when rendering
   - **Recovery**: Clean up invalid IDs on next TMS operation

3. **Component Rendering Errors**
   - **Scenario**: TMS component throws error during render
   - **Handling**: ErrorBoundary catches and displays fallback
   - **Recovery**: Offer button to reset TMS state and return to standard view

4. **Navigation Errors**
   - **Scenario**: User clicks project badge but project doesn't exist
   - **Handling**: Show toast notification "Project not found"
   - **Recovery**: Stay in current view

### Error Boundaries

```typescript
// Wrap TMS views in error boundary
<ErrorBoundary
  fallback={
    <div className="p-6 text-center">
      <p>Error loading TMS view</p>
      <Button onClick={() => setTimeManagementSystem(TimeManagementSystem.NONE)}>
        Return to Standard View
      </Button>
    </div>
  }
>
  {/* TMS View Component */}
</ErrorBoundary>
```

## Testing Strategy

### Unit Tests

Unit tests should focus on specific examples, edge cases, and integration points:

1. **GlobalTasksHeader Component**
   - TMS selector renders when `showTMSSelector={true}`
   - Display mode toggle renders when `showDisplayModeToggle={true}`
   - Display mode toggle hidden when `showDisplayModeToggle={false}`
   - Callbacks fire correctly

2. **TMS View Rendering Logic**
   - Correct view renders for each TMS setting
   - Only one view renders at a time
   - Standard view renders when TMS = NONE

3. **Project Information Display**
   - Project badge shows correct project name
   - "No Project" shows for unlinked tasks
   - Project click navigation works
   - Missing project handled gracefully

4. **Edge Cases**
   - Empty task list in TMS views
   - All tasks from single project
   - Mix of linked and unlinked tasks
   - Tasks with missing project references

### Property-Based Tests

Property tests should verify universal properties across all inputs with minimum 100 iterations each:

1. **Property 1: TMS View Activation**
   - Generate random TMS selections
   - Verify only correct view component is rendered
   - Tag: **Feature: global-tasks-tms-integration, Property 1: TMS View Activation**

2. **Property 2: TMS Metadata Consistency**
   - Generate random tasks and TMS operations
   - Perform operation in simulated global view
   - Verify metadata matches expected state
   - Verify same operation in project view produces same state
   - Tag: **Feature: global-tasks-tms-integration, Property 2: TMS Metadata Consistency**

3. **Property 3: Task Visibility**
   - Generate random task sets with various projects
   - Verify all non-completed tasks appear in TMS views
   - Tag: **Feature: global-tasks-tms-integration, Property 3: Task Visibility**

4. **Property 4: Project Information Display**
   - Generate random tasks with/without projects
   - Verify project info displayed correctly for all tasks
   - Tag: **Feature: global-tasks-tms-integration, Property 4: Project Information Display**

5. **Property 5: Display Mode Toggle Visibility**
   - Generate random TMS settings
   - Verify toggle visibility matches TMS = NONE condition
   - Tag: **Feature: global-tasks-tms-integration, Property 5: Display Mode Toggle Visibility**

### Testing Library

Use **Vitest** with **@testing-library/react** for both unit and property-based tests. For property-based testing, use **fast-check** library (already in dependencies).

### Test Configuration

```typescript
// vitest.config.ts - already configured
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});

// Property test example structure
import fc from 'fast-check';

describe('Property: TMS View Activation', () => {
  it('should render only the correct view for any TMS selection', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          TimeManagementSystem.NONE,
          TimeManagementSystem.DIT,
          TimeManagementSystem.AF4,
          TimeManagementSystem.FVP
        ),
        (tmsSelection) => {
          // Test logic here
          // Verify only correct view renders
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Implementation Notes

### Minimal Changes Philosophy

This design prioritizes minimal changes to existing code:

1. **No TMS Component Modifications**: Core TMS logic remains unchanged
2. **Additive Changes**: Only add new props, don't modify existing behavior
3. **Reuse Existing Patterns**: Follow same pattern as project view TMS integration
4. **Backward Compatibility**: All existing functionality continues to work

### Migration Path

No data migration needed:
- TMS state structure unchanged
- App settings structure unchanged
- Existing TMS metadata continues to work

### Performance Considerations

1. **Task Filtering**: Global view passes all tasks to TMS components
   - Current implementation already handles this efficiently
   - No performance concerns for typical task counts (<1000 tasks)

2. **Project Lookups**: Project badges require project lookups
   - Use `useMemo` to create project lookup map
   - O(1) lookup per task render

3. **Re-rendering**: TMS state changes trigger re-renders
   - Already optimized in existing TMS components
   - No additional optimization needed

### Accessibility

1. **Keyboard Navigation**: TMS selector accessible via keyboard
2. **Screen Readers**: Project badges have appropriate aria-labels
3. **Focus Management**: Focus remains on TMS controls after operations
4. **Color Contrast**: Project badges meet WCAG AA standards

### Future Extensibility

This design enables future enhancements:

1. **Project Filtering in TMS Views**: Add ability to filter TMS views by project
2. **Project-Specific TMS**: Option to have different TMS per project
3. **TMS Analytics**: Track TMS usage patterns across projects
4. **Bulk Operations**: Select multiple tasks across projects in TMS views
