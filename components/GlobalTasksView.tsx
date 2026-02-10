'use client';

import { useMemo } from 'react';
import { TaskList } from '@/components/TaskList';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { Circle } from 'lucide-react';
import { Task } from '@/types';

interface GlobalTasksViewProps {
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onAddTask: () => void;
  onViewSubtasks?: (taskId: string) => void;
  onSubtaskButtonClick?: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  selectedTaskId?: string | null;
}

// Extended task type with flat mode metadata
export interface TaskWithMetadata extends Task {
  _flatModeParentName?: string;
  _flatModeParentId?: string;
  _flatModeHasSubtasks?: boolean;
  _flatModeSubtaskCount?: number;
}

/**
 * Global Tasks View component - displays all tasks from all projects
 * Reuses existing TaskList component with project column enabled
 * Supports nested (default) and flat display modes
 */
export function GlobalTasksView({
  onTaskClick,
  onTaskComplete,
  onAddTask,
  onViewSubtasks,
  onSubtaskButtonClick,
  onAddSubtask,
  selectedTaskId
}: GlobalTasksViewProps) {
  const { tasks, sections } = useDataStore();
  const { globalTasksDisplayMode } = useAppStore();

  // Process tasks based on display mode
  const displayTasks = useMemo(() => {
    if (globalTasksDisplayMode === 'flat') {
      // Flat mode: Flatten parent-child relationships but keep section grouping
      // Within each section, show parent followed immediately by its subtasks
      
      const subtasksByParent = new Map<string, Task[]>();
      
      // Group subtasks by their parent
      tasks.forEach(task => {
        if (task.parentTaskId) {
          if (!subtasksByParent.has(task.parentTaskId)) {
            subtasksByParent.set(task.parentTaskId, []);
          }
          subtasksByParent.get(task.parentTaskId)!.push(task);
        }
      });
      
      // Sort subtasks by their order
      subtasksByParent.forEach((subtasks) => {
        subtasks.sort((a, b) => a.order - b.order);
      });
      
      // Build final ordered list, section by section
      const orderedTasks: TaskWithMetadata[] = [];
      
      // Process each section in order
      const sortedSections = [...sections].sort((a, b) => a.order - b.order);
      
      sortedSections.forEach(section => {
        // Get parent tasks in this section, sorted by order
        const sectionParents = tasks
          .filter(t => t.sectionId === section.id && !t.parentTaskId)
          .sort((a, b) => a.order - b.order);
        
        // For each parent, add it followed by its subtasks
        sectionParents.forEach(parentTask => {
          const subtasks = subtasksByParent.get(parentTask.id) || [];
          
          // Add parent task with metadata
          orderedTasks.push({
            ...parentTask,
            parentTaskId: null, // Clear parent to prevent nesting in UI
            _flatModeHasSubtasks: subtasks.length > 0,
            _flatModeSubtaskCount: subtasks.length
          });
          
          // Add its subtasks immediately after the parent
          subtasks.forEach(subtask => {
            orderedTasks.push({
              ...subtask,
              parentTaskId: null, // Clear parent to prevent nesting in UI
              _flatModeParentName: parentTask.description,
              _flatModeParentId: parentTask.id
            });
          });
        });
      });
      
      // Add unsectioned parent tasks and their subtasks
      const unsectionedParents = tasks
        .filter(t => !t.sectionId && !t.parentTaskId)
        .sort((a, b) => a.order - b.order);
      
      unsectionedParents.forEach(parentTask => {
        const subtasks = subtasksByParent.get(parentTask.id) || [];
        
        orderedTasks.push({
          ...parentTask,
          parentTaskId: null,
          _flatModeHasSubtasks: subtasks.length > 0,
          _flatModeSubtaskCount: subtasks.length
        });
        
        subtasks.forEach(subtask => {
          orderedTasks.push({
            ...subtask,
            parentTaskId: null,
            _flatModeParentName: parentTask.description,
            _flatModeParentId: parentTask.id
          });
        });
      });
      
      return orderedTasks;
    }
    
    // Nested mode: Show tasks with their natural hierarchy
    return tasks;
  }, [tasks, globalTasksDisplayMode, sections]);

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Circle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No tasks yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create a task to get started</p>
      </div>
    );
  }

  return (
    <TaskList
      tasks={displayTasks}
      sections={sections}
      onTaskClick={onTaskClick}
      onTaskComplete={onTaskComplete}
      onAddTask={onAddTask}
      onViewSubtasks={onViewSubtasks}
      onSubtaskButtonClick={onSubtaskButtonClick}
      onAddSubtask={globalTasksDisplayMode === 'nested' ? onAddSubtask : undefined} // Disable subtask creation in flat mode
      selectedTaskId={selectedTaskId}
      showProjectColumn={true}
      flatMode={globalTasksDisplayMode === 'flat'}
    />
  );
}
