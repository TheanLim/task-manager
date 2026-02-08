# Design Document: Subtask Creation

## Overview

This design implements subtask creation functionality by extending the existing task creation workflow. The implementation leverages the existing TaskDialog component and adds minimal state management to track parent task context during subtask creation. The design follows the established patterns in the codebase for task creation while adding specific logic for property inheritance and completion cascading.

## Architecture

The subtask creation feature integrates into the existing architecture with minimal changes:

```
┌─────────────────────────────────────────────────────────────┐
│                         app/page.tsx                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  State Management                                       │ │
│  │  - taskDialogParentId: string | null                   │ │
│  │  - taskDialogSectionId: string | null                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Handlers                                               │ │
│  │  - handleNewTask(sectionId?, parentTaskId?)            │ │
│  │  - handleTaskSubmit(data)                              │ │
│  │  - handleTaskComplete(taskId, completed)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─────────────────────────────────┐
                            │                                 │
                            ▼                                 ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│     TaskDetailPanel                  │   │      TaskDialog              │
│  ┌────────────────────────────────┐  │   │  ┌────────────────────────┐ │
│  │  Props                         │  │   │  │  Props                 │ │
│  │  - onAddSubtask: () => void    │  │   │  │  - task?: Task | null  │ │
│  └────────────────────────────────┘  │   │  └────────────────────────┘ │
│  ┌────────────────────────────────┐  │   │  ┌────────────────────────┐ │
│  │  Conditional Rendering         │  │   │  │  Pre-population Logic  │ │
│  │  - Show "Add Subtask" only if  │  │   │  │  - Inherit from parent │ │
│  │    task.parentTaskId === null  │  │   │  │    if creating subtask │ │
│  └────────────────────────────────┘  │   │  └────────────────────────┘ │
└──────────────────────────────────────┘   └──────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      stores/dataStore.ts                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Methods                                                │ │
│  │  - addTask(task)                                        │ │
│  │  - updateTask(id, updates)                             │ │
│  │  - getSubtasks(parentId)                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Main Page State Extensions (app/page.tsx)

**New State Variable:**
```typescript
const [taskDialogParentId, setTaskDialogParentId] = useState<string | null>(null);
```

**Modified Handler:**
```typescript
const handleNewTask = (sectionId?: string, parentTaskId?: string) => {
  if (!activeProject) return;
  setEditingTask(null);
  setTaskDialogSectionId(sectionId || null);
  setTaskDialogParentId(parentTaskId || null);  // NEW
  setTaskDialogOpen(true);
};
```

**Modified Submit Handler:**
```typescript
const handleTaskSubmit = (data: {
  description: string;
  notes: string;
  assignee: string;
  priority: Priority;
  tags: string[];
  dueDate: string | null;
}) => {
  if (!activeProject) return;

  if (editingTask) {
    updateTask(editingTask, data);
  } else {
    const newTask = {
      id: uuidv4(),
      projectId: activeProject.id,
      parentTaskId: taskDialogParentId,  // MODIFIED: Use state instead of null
      sectionId: taskDialogSectionId || projectSections[0]?.id || null,
      ...data,
      completed: false,
      completedAt: null,
      order: taskDialogParentId 
        ? getSubtasks(taskDialogParentId).length  // NEW: Order within subtasks
        : projectTasks.length,                     // Existing: Order within project
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    addTask(newTask);
  }
  setTaskDialogSectionId(null);
  setTaskDialogParentId(null);  // NEW: Reset parent ID
};
```

**New Completion Handler Logic:**
```typescript
const handleTaskComplete = (taskId: string, completed: boolean) => {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  // Update the task itself
  updateTask(taskId, {
    completed,
    completedAt: completed ? new Date().toISOString() : null
  });
  
  // If this is a parent task, cascade to subtasks
  if (task.parentTaskId === null) {
    const subtasks = getSubtasks(taskId);
    subtasks.forEach(subtask => {
      updateTask(subtask.id, {
        completed,
        completedAt: completed ? new Date().toISOString() : null
      });
    });
  }
};
```

**Modified onAddSubtask Handler:**
```typescript
onAddSubtask={() => {
  if (selectedTask) {
    handleNewTask(selectedTask.sectionId, selectedTask.id);
  }
}}
```

### 2. TaskDetailPanel Modifications (components/TaskDetailPanel.tsx)

**Conditional Rendering of Add Subtask Button:**
```typescript
{/* Subtasks */}
<Separator />
<div>
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-sm font-semibold">Subtasks ({subtasks.length})</h3>
    {task.parentTaskId === null && (  // NEW: Only show for top-level tasks
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" onClick={onAddSubtask}>
            <Plus className="mr-2 h-4 w-4" />
            Add Subtask
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add a new subtask</p>
        </TooltipContent>
      </Tooltip>
    )}
  </div>
  {/* ... rest of subtasks rendering ... */}
</div>
```

### 3. TaskDialog Pre-population (components/TaskDialog.tsx)

**Modified useEffect for Form Initialization:**
```typescript
useEffect(() => {
  if (open) {
    if (task) {
      // Editing existing task
      setDescription(task.description);
      setNotes(task.notes);
      setAssignee(task.assignee);
      setPriority(task.priority);
      setTags(task.tags);
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
    } else {
      // Creating new task - check if we need to inherit from parent
      // This will be handled by passing a parentTask prop
      setDescription('');
      setNotes('');
      setAssignee('');
      setPriority(Priority.NONE);
      setTags([]);
      setDueDate(undefined);
    }
    setTagInput('');
    setShowCalendar(false);
    setError(null);
  }
}, [open, task]);
```

**Alternative Approach: Pass Parent Task for Inheritance**

Modify TaskDialog interface:
```typescript
interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    description: string;
    notes: string;
    assignee: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
  }) => void;
  task?: Task | null;
  parentTask?: Task | null;  // NEW: For property inheritance
}
```

Modified useEffect:
```typescript
useEffect(() => {
  if (open) {
    if (task) {
      // Editing existing task
      setDescription(task.description);
      setNotes(task.notes);
      setAssignee(task.assignee);
      setPriority(task.priority);
      setTags(task.tags);
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
    } else if (parentTask) {
      // Creating subtask - inherit from parent
      setDescription('');
      setNotes('');
      setAssignee(parentTask.assignee);
      setPriority(parentTask.priority);
      setTags([...parentTask.tags]);
      setDueDate(undefined);
    } else {
      // Creating new top-level task
      setDescription('');
      setNotes('');
      setAssignee('');
      setPriority(Priority.NONE);
      setTags([]);
      setDueDate(undefined);
    }
    setTagInput('');
    setShowCalendar(false);
    setError(null);
  }
}, [open, task, parentTask]);
```

## Data Models

No changes to existing data models. The Task interface already supports subtasks via the `parentTaskId` field:

```typescript
export interface Task {
  id: UUID;
  projectId: UUID;
  parentTaskId: UUID | null;  // null for top-level tasks, UUID for subtasks
  sectionId: UUID | null;
  description: string;
  notes: string;
  assignee: string;
  priority: Priority;
  tags: string[];
  dueDate: ISODateString | null;
  completed: boolean;
  completedAt: ISODateString | null;
  order: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Subtask Parent ID Assignment

*For any* parent task and any valid subtask data, when a subtask is created, the subtask's parentTaskId should equal the parent task's ID.

**Validates: Requirements 1.3, 3.3**

### Property 2: Property Inheritance from Parent

*For any* parent task, when a subtask is created from that parent, the subtask should inherit the parent's projectId, sectionId, priority, tags, and assignee at creation time.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Subtask Ordering

*For any* parent task with N existing subtasks, when a new subtask is created, the new subtask's order value should equal N.

**Validates: Requirements 1.4**

### Property 4: Add Subtask Button Visibility for Top-Level Tasks

*For any* task where parentTaskId is null, the Task Detail Panel should display an "Add Subtask" button.

**Validates: Requirements 3.1**

### Property 5: Add Subtask Button Hidden for Subtasks

*For any* task where parentTaskId is not null, the Task Detail Panel should NOT display an "Add Subtask" button.

**Validates: Requirements 3.2**

### Property 6: Prevention of Nested Subtasks

*For any* task that has a non-null parentTaskId, attempting to create a subtask should be prevented (the Add Subtask button should not be available).

**Validates: Requirements 3.4**

### Property 7: Parent Task ID State Tracking

*For any* subtask creation workflow, when the Task Dialog is opened, the component state should track the parent task's ID.

**Validates: Requirements 4.1**

### Property 8: State Reset After Dialog Close

*For any* Task Dialog close or submit event, the parent task ID state should be reset to null.

**Validates: Requirements 4.2**

### Property 9: Parent Completion Cascades to Subtasks

*For any* parent task with subtasks, when the parent is marked as completed, all subtasks should be marked as completed with non-null completedAt timestamps.

**Validates: Requirements 5.1, 5.2**

### Property 10: Parent Incompletion Cascades to Subtasks

*For any* parent task with subtasks, when the parent is marked as incomplete, all subtasks should be marked as incomplete with null completedAt timestamps.

**Validates: Requirements 5.3, 5.4**

## Error Handling

### Invalid Parent Task ID

If `handleNewTask` is called with a `parentTaskId` that doesn't exist in the data store:
- The system should log a warning
- The system should treat it as a regular task creation (parentTaskId = null)
- This is a defensive measure against race conditions

### Attempting to Create Subtask of Subtask

The UI prevents this by not showing the "Add Subtask" button for tasks with non-null parentTaskId. However, if somehow triggered programmatically:
- The system should validate that the parent task has parentTaskId === null
- If validation fails, show an error message and prevent creation
- This is a defensive measure against API misuse

### Completion Cascade Failures

If updating subtasks during completion cascade fails:
- Log the error for debugging
- Continue attempting to update remaining subtasks
- Do not roll back the parent task's completion status
- This ensures partial success rather than complete failure

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific UI interactions (button clicks, dialog opening)
- Edge cases (empty subtask lists, single subtask)
- Error conditions (invalid parent IDs, cascade failures)
- Integration between components

**Property-Based Tests** focus on:
- Universal properties across all inputs (property inheritance, ordering, cascading)
- Comprehensive input coverage through randomization
- Verifying correctness properties hold for all valid task configurations

### Property-Based Testing Configuration

- **Library**: fast-check (already in package.json)
- **Minimum iterations**: 100 per property test
- **Test tagging**: Each property test must reference its design property
- **Tag format**: `// Feature: subtask-creation, Property {number}: {property_text}`

### Test Coverage Requirements

**Unit Tests should cover:**
1. Add Subtask button click opens TaskDialog with correct parent ID
2. TaskDialog pre-populates inherited fields when creating subtask
3. Cancel button closes dialog without creating task
4. Successful subtask creation closes dialog and updates subtask list
5. Add Subtask button is visible for top-level tasks
6. Add Subtask button is hidden for subtasks
7. Completion cascade updates all subtasks
8. Incompletion cascade updates all subtasks

**Property Tests should cover:**
1. Property 1: Subtask Parent ID Assignment
2. Property 2: Property Inheritance from Parent
3. Property 3: Subtask Ordering
4. Property 9: Parent Completion Cascades to Subtasks
5. Property 10: Parent Incompletion Cascades to Subtasks

### Testing Tools

- **Test Framework**: Vitest (already configured)
- **Property Testing**: fast-check
- **Component Testing**: @testing-library/react
- **Test Location**: Co-located with components (*.test.tsx files)

### Example Property Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Subtask Creation Properties', () => {
  it('Property 2: Property Inheritance from Parent', () => {
    // Feature: subtask-creation, Property 2: Property Inheritance from Parent
    fc.assert(
      fc.property(
        fc.record({
          projectId: fc.uuid(),
          sectionId: fc.uuid(),
          priority: fc.constantFrom('none', 'low', 'medium', 'high'),
          tags: fc.array(fc.string(), { maxLength: 5 }),
          assignee: fc.string()
        }),
        (parentTask) => {
          // Create subtask with parent properties
          const subtask = createSubtask(parentTask);
          
          // Verify inheritance
          expect(subtask.projectId).toBe(parentTask.projectId);
          expect(subtask.sectionId).toBe(parentTask.sectionId);
          expect(subtask.priority).toBe(parentTask.priority);
          expect(subtask.tags).toEqual(parentTask.tags);
          expect(subtask.assignee).toBe(parentTask.assignee);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```
