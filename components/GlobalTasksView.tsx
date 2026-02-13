'use client';

import { useMemo } from 'react';
import { TaskList } from '@/components/TaskList';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { Circle } from 'lucide-react';
import { Task, Section } from '@/types';

interface GlobalTasksViewProps {
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onAddTask: (sectionId?: string) => void;
  onViewSubtasks?: (taskId: string) => void;
  onSubtaskButtonClick?: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  selectedTaskId?: string | null;
  onProjectClick?: (projectId: string) => void;
}

// Extended task type with flat mode metadata
export interface TaskWithMetadata extends Task {
  _flatModeParentName?: string;
  _flatModeParentId?: string;
  _flatModeHasSubtasks?: boolean;
  _flatModeSubtaskCount?: number;
}

// Virtual section ID for tasks from projects
const FROM_PROJECTS_SECTION_ID = '__from_projects__';

/**
 * Global Tasks View component - displays all tasks from all projects
 * Groups project tasks into "From Projects" section
 * Unlinked tasks can have their own sections
 */
export function GlobalTasksView({
  onTaskClick,
  onTaskComplete,
  onAddTask,
  onViewSubtasks,
  onSubtaskButtonClick,
  onAddSubtask,
  selectedTaskId,
  onProjectClick
}: GlobalTasksViewProps) {
  const { tasks, sections, projects } = useDataStore();
  const { globalTasksDisplayMode } = useAppStore();

  // Separate tasks: those with projects vs unlinked tasks
  // Project tasks are sorted by project name so they group by project on initial render
  const { projectTasks, unlinkedTasks, unlinkedSections } = useMemo(() => {
    const projectNameMap = new Map(projects.map(p => [p.id, p.name]));
    const projectTasks = tasks
      .filter(t => t.projectId !== null)
      .sort((a, b) => {
        const nameA = projectNameMap.get(a.projectId!) || '';
        const nameB = projectNameMap.get(b.projectId!) || '';
        return nameA.localeCompare(nameB);
      });
    const unlinkedTasks = tasks.filter(t => t.projectId === null);
    const unlinkedSections = sections.filter(s => s.projectId === null);
    
    return { projectTasks, unlinkedTasks, unlinkedSections };
  }, [tasks, sections, projects]);

  // Create virtual "From Projects" section
  const virtualFromProjectsSection: Section = useMemo(() => ({
    id: FROM_PROJECTS_SECTION_ID,
    projectId: null, // Use null so new sections inherit the correct projectId
    name: 'From Projects',
    order: -1, // Show first
    collapsed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }), []);

  // Process tasks and sections based on display mode
  const { displayTasks, displaySections } = useMemo(() => {
    // Assign all project tasks to the virtual "From Projects" section
    const tasksWithVirtualSection = projectTasks.map(task => ({
      ...task,
      sectionId: FROM_PROJECTS_SECTION_ID
    }));
    
    // Combine with unlinked tasks (keep their original sections)
    const allTasks = [...tasksWithVirtualSection, ...unlinkedTasks];
    
    // Create sections list: virtual section + unlinked sections
    const allSections = [virtualFromProjectsSection, ...unlinkedSections];

    if (globalTasksDisplayMode === 'flat') {
      // Flat mode: Flatten parent-child relationships
      const subtasksByParent = new Map<string, Task[]>();
      
      allTasks.forEach(task => {
        if (task.parentTaskId) {
          if (!subtasksByParent.has(task.parentTaskId)) {
            subtasksByParent.set(task.parentTaskId, []);
          }
          subtasksByParent.get(task.parentTaskId)!.push(task);
        }
      });
      
      subtasksByParent.forEach((subtasks) => {
        subtasks.sort((a, b) => a.order - b.order);
      });
      
      const orderedTasks: TaskWithMetadata[] = [];
      
      // Process sectioned tasks
      allSections.forEach(section => {
        const sectionParents = allTasks
          .filter(t => t.sectionId === section.id && !t.parentTaskId)
          .sort((a, b) => a.order - b.order);
        
        sectionParents.forEach(parentTask => {
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
              sectionId: parentTask.sectionId,
              _flatModeParentName: parentTask.description,
              _flatModeParentId: parentTask.id
            });
          });
        });
      });
      
      // Process unsectioned tasks
      const unsectionedParents = allTasks
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
            sectionId: null, // Keep as unsectioned
            _flatModeParentName: parentTask.description,
            _flatModeParentId: parentTask.id
          });
        });
      });
      
      return { displayTasks: orderedTasks, displaySections: allSections };
    }
    
    // Nested mode: Show tasks with their natural hierarchy
    return { displayTasks: allTasks, displaySections: allSections };
  }, [projectTasks, unlinkedTasks, unlinkedSections, virtualFromProjectsSection, globalTasksDisplayMode]);

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
      sections={displaySections}
      onTaskClick={onTaskClick}
      onTaskComplete={onTaskComplete}
      onAddTask={onAddTask}
      onViewSubtasks={onViewSubtasks}
      onSubtaskButtonClick={onSubtaskButtonClick}
      onAddSubtask={globalTasksDisplayMode === 'nested' ? onAddSubtask : undefined}
      selectedTaskId={selectedTaskId}
      showProjectColumn={true}
      onProjectClick={onProjectClick}
      flatMode={globalTasksDisplayMode === 'flat'}
      initialSortByProject={true}
    />
  );
}
