'use client';

import { useMemo, useCallback, useState } from 'react';
import { TaskList } from '@/features/tasks/components/TaskList';
import { useDataStore, taskService } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { Circle } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Task, Section } from '@/types';
import { filterAutoHiddenTasks } from '@/features/tasks/services/autoHideService';

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
  const needsAttentionSort = useAppStore((s) => s.needsAttentionSort);
  const hideCompletedTasks = useAppStore((s) => s.hideCompletedTasks);
  const autoHideThreshold = useAppStore((s) => s.autoHideThreshold);
  const showRecentlyCompleted = useAppStore((s) => s.showRecentlyCompleted);

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

  // Track collapsed state for the virtual "From Projects" section locally
  // (it doesn't exist in the repository, so updateSection won't persist it)
  const [fromProjectsCollapsed, setFromProjectsCollapsed] = useState(false);

  // Create virtual "Tasks" section (groups all project-linked tasks)
  const virtualFromProjectsSection: Section = useMemo(() => ({
    id: FROM_PROJECTS_SECTION_ID,
    projectId: null,
    name: 'Tasks',
    order: -1,
    collapsed: fromProjectsCollapsed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }), [fromProjectsCollapsed]);

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
      
      // Build a project-name lookup for sorting (mirrors nested mode's pre-sort)
      const projectNameMap = new Map(projects.map(p => [p.id, p.name]));

      // Process sectioned tasks
      allSections.forEach(section => {
        const sectionParents = allTasks
          .filter(t => t.sectionId === section.id && !t.parentTaskId)
          .sort((a, b) => {
            const nameA = a.projectId ? (projectNameMap.get(a.projectId) || '') : '';
            const nameB = b.projectId ? (projectNameMap.get(b.projectId) || '') : '';
            const cmp = nameA.localeCompare(nameB);
            return cmp !== 0 ? cmp : a.order - b.order;
          });
        
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
        .sort((a, b) => {
          const nameA = a.projectId ? (projectNameMap.get(a.projectId) || '') : '';
          const nameB = b.projectId ? (projectNameMap.get(b.projectId) || '') : '';
          const cmp = nameA.localeCompare(nameB);
          return cmp !== 0 ? cmp : a.order - b.order;
        });
      
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
  }, [projectTasks, unlinkedTasks, unlinkedSections, virtualFromProjectsSection, globalTasksDisplayMode, projects]);

  // Filter completed tasks based on mode
  // Priority: Review Queue / Hide Completed → hide ALL completed
  // Recently Completed → show ONLY auto-hidden tasks
  // Normal → apply time-based auto-hide filter
  const filteredTasks = useMemo(() => {
    if (needsAttentionSort || hideCompletedTasks) {
      // Review Queue or Hide Completed: hide all completed (existing behavior)
      return displayTasks.filter(t => !t.completed);
    }
    if (autoHideThreshold === 'never' && !showRecentlyCompleted) {
      return displayTasks;
    }
    const result = filterAutoHiddenTasks(displayTasks, tasks, {
      threshold: autoHideThreshold,
      displayMode: globalTasksDisplayMode,
    });
    if (showRecentlyCompleted) {
      // Show only the auto-hidden tasks
      return result.autoHidden;
    }
    return result.visible;
  }, [displayTasks, tasks, needsAttentionSort, hideCompletedTasks,
      autoHideThreshold, showRecentlyCompleted, globalTasksDisplayMode]);

  // Determine whether to hide completed subtasks in TaskRow
  const shouldHideCompletedSubtasks = needsAttentionSort || hideCompletedTasks;

  // Reinsert callback — delegates to TaskService
  const handleReinsert = useCallback((taskId: string) => {
    taskService.reinsertTask(taskId);
  }, []);

  // Section toggle — handle virtual "From Projects" section locally, delegate others to store
  const { updateSection } = useDataStore();
  const handleToggleSection = useCallback((sectionId: string) => {
    if (sectionId === FROM_PROJECTS_SECTION_ID) {
      setFromProjectsCollapsed(prev => !prev);
    } else {
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        updateSection(sectionId, { collapsed: !section.collapsed });
      }
    }
  }, [sections, updateSection]);

  // The virtual "Tasks" section is read-only — no edit/delete/drag/collapse
  const readonlySectionIds = useMemo(() => new Set([FROM_PROJECTS_SECTION_ID]), []);

  // Empty state
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={Circle}
        title="Ready to get things done"
        description="Create a task to start tracking your work"
      />
    );
  }

  return (
    <TaskList
      tasks={filteredTasks}
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
      showReinsertButton={needsAttentionSort}
      onReinsert={needsAttentionSort ? handleReinsert : undefined}
      onToggleSection={handleToggleSection}
      hideCompletedSubtasks={shouldHideCompletedSubtasks}
      readonlySectionIds={readonlySectionIds}
    />
  );
}
