'use client';

import React from 'react';
import { Circle, ChevronRight, ChevronDown, MoreVertical, Plus, GripVertical, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Task, Section } from '@/types';
import { useState, useRef } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateSectionName } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore, TaskColumnId, DEFAULT_COLUMN_ORDER } from '@/stores/appStore';
import { Priority } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import { cn } from '@/lib/utils';
import { getEffectiveLastActionTime } from '@/features/tasks/services/taskService';

interface TaskListProps {
  tasks: Task[];
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onAddTask: (sectionId: string) => void;
  onViewSubtasks?: (taskId: string) => void;
  onSubtaskButtonClick?: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  selectedTaskId?: string | null;
  showProjectColumn?: boolean;
  onProjectClick?: (projectId: string) => void;
  flatMode?: boolean;
  initialSortByProject?: boolean;
  showReinsertButton?: boolean;
  onReinsert?: (taskId: string) => void;
  onToggleSection?: (sectionId: string) => void;
  hideCompletedSubtasks?: boolean;
}

interface ColumnWidths {
  name: number;
  dueDate: number;
  priority: number;
  assignee: number;
  tags: number;
  project?: number;
}

// Column display metadata
const COLUMN_LABELS: Record<TaskColumnId, string> = {
  dueDate: 'Due date',
  priority: 'Priority',
  assignee: 'Assignee',
  tags: 'Tags',
  project: 'Project',
};

/**
 * List view component for displaying tasks grouped by collapsible sections
 * with table-like task rows and draggable column headers
 */
export function TaskList({ tasks, sections, onTaskClick, onTaskComplete, onAddTask, onViewSubtasks, onSubtaskButtonClick, onAddSubtask, selectedTaskId, showProjectColumn = false, onProjectClick, flatMode = false, initialSortByProject = false, showReinsertButton = false, onReinsert, onToggleSection, hideCompletedSubtasks = false }: TaskListProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [sectionWasExpanded, setSectionWasExpanded] = useState<boolean>(false);
  const [taskWasExpanded, setTaskWasExpanded] = useState<boolean>(false);
  const [userHasReordered, setUserHasReordered] = useState<boolean>(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const { updateTask, updateSection, deleteSection, addSection, projects } = useDataStore();

  // Column order and sort state from persisted store
  const { columnOrder, setColumnOrder, sortColumn, sortDirection, toggleSort } = useAppStore();

  // Column drag state — use refs to avoid stale closures during drag events
  const [draggedColumnId, setDraggedColumnId] = useState<TaskColumnId | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<TaskColumnId | null>(null);
  const draggedColumnRef = useRef<TaskColumnId | null>(null);

  // Compute the visible columns in order (always include 'project' at its stored position if showProjectColumn)
  const visibleColumns: TaskColumnId[] = (() => {
    // Start with stored order, ensure all default columns are present
    const order = [...columnOrder];
    // Add any missing default columns at the end
    for (const col of DEFAULT_COLUMN_ORDER) {
      if (!order.includes(col)) order.push(col);
    }
    // If project column should be shown and isn't in the stored order, default to first position
    if (showProjectColumn && !order.includes('project')) {
      order.unshift('project');
    }
    // Filter out project if not showing
    return order.filter(col => col !== 'project' || showProjectColumn);
  })();

  // Helper function to get project name for a task
  const getProjectName = (task: Task): string => {
    if (!task.projectId) return 'No Project';
    const project = projects.find(p => p.id === task.projectId);
    return project?.name || 'Unknown Project';
  };

  // Calculate minimum column widths based on content
  const calculateMinWidths = (): ColumnWidths => {
    const minWidths: ColumnWidths = {
      name: 200,
      dueDate: 100,
      priority: 80,
      assignee: 100,
      tags: 120,
      ...(showProjectColumn && { project: 120 })
    };

    tasks.forEach(task => {
      const nameWidth = Math.min(400, task.description.length * 8 + 100);
      minWidths.name = Math.max(minWidths.name, nameWidth);
      if (task.assignee) {
        const assigneeWidth = Math.min(200, task.assignee.length * 8 + 20);
        minWidths.assignee = Math.max(minWidths.assignee, assigneeWidth);
      }
      if (task.tags.length > 0) {
        const tagsWidth = Math.min(300, task.tags.length * 60);
        minWidths.tags = Math.max(minWidths.tags, tagsWidth);
      }
    });

    return minWidths;
  };

  const minColumnWidths = calculateMinWidths();

  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    name: Math.max(300, minColumnWidths.name),
    dueDate: Math.max(128, minColumnWidths.dueDate),
    priority: Math.max(96, minColumnWidths.priority),
    assignee: Math.max(128, minColumnWidths.assignee),
    tags: Math.max(160, minColumnWidths.tags),
    ...(showProjectColumn && { project: Math.max(128, minColumnWidths.project || 120) })
  });

  const handleColumnResize = (column: keyof ColumnWidths, width: number) => {
    const minWidth = minColumnWidths[column] || 100;
    const constrainedWidth = Math.max(minWidth, width);
    setColumnWidths(prev => ({ ...prev, [column]: constrainedWidth }));
  };

  // --- Column drag-and-drop handlers ---
  const handleColumnDragStart = (e: React.DragEvent, columnId: TaskColumnId) => {
    draggedColumnRef.current = columnId;
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `column:${columnId}`);
  };

  const handleColumnDragOver = (e: React.DragEvent, columnId: TaskColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    const dragged = draggedColumnRef.current;
    if (!dragged || dragged === columnId) return;

    // Live reorder: swap columns as you drag over them
    const currentOrder = useAppStore.getState().columnOrder;
    const order = [...currentOrder];
    for (const col of DEFAULT_COLUMN_ORDER) {
      if (!order.includes(col)) order.push(col);
    }
    if (showProjectColumn && !order.includes('project')) {
      order.push('project');
    }
    const filtered = order.filter(col => col !== 'project' || showProjectColumn);

    const draggedIndex = filtered.indexOf(dragged);
    const targetIndex = filtered.indexOf(columnId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    filtered.splice(draggedIndex, 1);
    filtered.splice(targetIndex, 0, dragged);
    setColumnOrder(filtered);
  };

  const handleColumnDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleColumnDrop = (e: React.DragEvent, _targetColumnId: TaskColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    draggedColumnRef.current = null;
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const handleColumnDragEnd = () => {
    draggedColumnRef.current = null;
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const handleTaskComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      onTaskComplete(taskId, !task.completed);
    }
  };

  const handleViewSubtasks = (taskId: string) => {
    if (onViewSubtasks) {
      onViewSubtasks(taskId);
    } else {
      onTaskClick(taskId);
    }
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    // Let parent handle toggle if callback provided (e.g. for virtual sections)
    if (onToggleSection) {
      onToggleSection(sectionId);
    } else {
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        updateSection(sectionId, { collapsed: !section.collapsed });
      }
    }
  };

  const handleRenameSection = (sectionId: string, newName: string) => {
    updateSection(sectionId, { name: newName });
  };

  const handleDeleteSection = (sectionId: string) => {
    setSectionToDelete(sectionId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDeleteSection = () => {
    if (sectionToDelete) {
      deleteSection(sectionToDelete);
      setSectionToDelete(null);
    }
    setShowDeleteDialog(false);
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    const projectId = sections[0]?.projectId || null;
    const newSection = {
      id: uuidv4(),
      projectId,
      name: newSectionName.trim(),
      order: sections.length,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addSection(newSection);
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const handleCancelAddSection = () => {
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const handleAddTask = (sectionId: string) => {
    onAddTask(sectionId);
  };

  // --- Task drag-and-drop handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTaskId(taskId);
  };

  const handleTaskDragLeave = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTaskId(null);
  };

  const handleTaskDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTaskId(null);
    
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      return;
    }

    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask) {
      setDraggedTaskId(null);
      return;
    }

    if (draggedTask.parentTaskId !== targetTask.parentTaskId) {
      setDraggedTaskId(null);
      return;
    }
    
    if (draggedTask.parentTaskId && targetTask.parentTaskId) {
      const parentSubtasks = tasks
        .filter(t => t.parentTaskId === draggedTask.parentTaskId)
        .sort((a, b) => a.order - b.order);
      const draggedIndex = parentSubtasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = parentSubtasks.findIndex(t => t.id === targetTaskId);
      if (draggedIndex === -1 || targetIndex === -1) { setDraggedTaskId(null); return; }
      const reorderedSubtasks = [...parentSubtasks];
      const [removed] = reorderedSubtasks.splice(draggedIndex, 1);
      reorderedSubtasks.splice(targetIndex, 0, removed);
      reorderedSubtasks.forEach((subtask, index) => { updateTask(subtask.id, { order: index }); });
      setDraggedTaskId(null);
      return;
    }

    if (draggedTask.sectionId !== targetTask.sectionId) {
      const targetSectionTasks = tasks
        .filter(t => t.sectionId === targetTask.sectionId && !t.parentTaskId && t.id !== draggedTaskId)
        .sort((a, b) => a.order - b.order);
      const targetIndex = targetSectionTasks.findIndex(t => t.id === targetTaskId);
      if (targetIndex === -1) { setDraggedTaskId(null); return; }
      targetSectionTasks.splice(targetIndex, 0, draggedTask);
      updateTask(draggedTaskId, { sectionId: targetTask.sectionId, order: targetIndex });
      targetSectionTasks.forEach((task, index) => {
        if (task.id !== draggedTaskId) { updateTask(task.id, { order: index }); }
      });
    } else {
      const sectionTasks = tasks
        .filter(t => t.sectionId === draggedTask.sectionId && !t.parentTaskId)
        .sort((a, b) => a.order - b.order);
      const draggedIndex = sectionTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = sectionTasks.findIndex(t => t.id === targetTaskId);
      if (draggedIndex === -1 || targetIndex === -1) { setDraggedTaskId(null); return; }
      const reorderedTasks = [...sectionTasks];
      const [removed] = reorderedTasks.splice(draggedIndex, 1);
      reorderedTasks.splice(targetIndex, 0, removed);
      reorderedTasks.forEach((task, index) => { updateTask(task.id, { order: index }); });
    }

    setUserHasReordered(true);
    setDraggedTaskId(null);
  };

  const handleDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask(draggedTaskId, { sectionId });
      setUserHasReordered(true);
      setDraggedTaskId(null);
    }
  };

  // Section drag-and-drop handlers
  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      setSectionWasExpanded(!section.collapsed);
      if (!section.collapsed) {
        updateSection(sectionId, { collapsed: true });
      }
    }
    setDraggedSectionId(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedSectionId && draggedSectionId !== sectionId) {
      setDragOverSectionId(sectionId);
    }
  };

  const handleSectionDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSectionId(null);
  };

  const handleSectionDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSectionId && sectionWasExpanded) {
      updateSection(draggedSectionId, { collapsed: false });
    }
    setDraggedSectionId(null);
    setSectionWasExpanded(false);
    setDragOverSectionId(null);
  };

  const handleSectionDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSectionId(null);

    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      if (draggedSectionId && sectionWasExpanded) {
        updateSection(draggedSectionId, { collapsed: false });
      }
      setDraggedSectionId(null);
      setSectionWasExpanded(false);
      return;
    }

    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    const draggedIndex = sortedSections.findIndex(s => s.id === draggedSectionId);
    const targetIndex = sortedSections.findIndex(s => s.id === targetSectionId);

    if (draggedIndex === -1 || targetIndex === -1) {
      if (sectionWasExpanded) { updateSection(draggedSectionId, { collapsed: false }); }
      setDraggedSectionId(null);
      setSectionWasExpanded(false);
      return;
    }

    const reorderedSections = [...sortedSections];
    const [removed] = reorderedSections.splice(draggedIndex, 1);
    reorderedSections.splice(targetIndex, 0, removed);
    reorderedSections.forEach((section, index) => { updateSection(section.id, { order: index }); });

    if (sectionWasExpanded) { updateSection(draggedSectionId, { collapsed: false }); }
    setDraggedSectionId(null);
    setSectionWasExpanded(false);
  };

  // Priority sort weights: higher priority = lower number (sorts first in ascending)
  const PRIORITY_WEIGHT: Record<string, number> = {
    [Priority.HIGH]: 0,
    [Priority.MEDIUM]: 1,
    [Priority.LOW]: 2,
    [Priority.NONE]: 3,
  };

  // Sort comparator for tasks based on active sort column
  const sortTasks = (taskList: Task[]): Task[] => {
    if (!sortColumn) return taskList;

    const dir = sortDirection === 'asc' ? 1 : -1;

    return [...taskList].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':
          cmp = a.description.localeCompare(b.description);
          break;
        case 'dueDate': {
          // Null dates go to the end regardless of direction
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) return 1;
          else if (!b.dueDate) return -1;
          else cmp = a.dueDate.localeCompare(b.dueDate);
          break;
        }
        case 'priority':
          cmp = (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
          break;
        case 'assignee': {
          // Empty assignee goes to the end regardless of direction
          const aEmpty = !a.assignee.trim();
          const bEmpty = !b.assignee.trim();
          if (aEmpty && bEmpty) cmp = 0;
          else if (aEmpty) return 1;
          else if (bEmpty) return -1;
          else cmp = a.assignee.localeCompare(b.assignee);
          break;
        }
        case 'tags': {
          // Sort by number of tags first, then alphabetically by joined tag string
          cmp = a.tags.length - b.tags.length;
          if (cmp === 0) {
            cmp = [...a.tags].sort().join(',').localeCompare([...b.tags].sort().join(','));
          }
          break;
        }
        case 'project': {
          const nameA = getProjectName(a);
          const nameB = getProjectName(b);
          // "No Project" goes to the end regardless of direction
          const aNoProject = nameA === 'No Project';
          const bNoProject = nameB === 'No Project';
          if (aNoProject && bNoProject) cmp = 0;
          else if (aNoProject) return 1;
          else if (bNoProject) return -1;
          else cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'lastAction': {
          const aTime = getEffectiveLastActionTime(a);
          const bTime = getEffectiveLastActionTime(b);
          cmp = aTime.localeCompare(bTime);
          break;
        }
      }
      return cmp * dir;
    });
  };

  // Group tasks by section
  const tasksBySection = sections.reduce((acc, section) => {
    if (flatMode) {
      const sectionTasks = tasks.filter(t => t.sectionId === section.id);
      if (sortColumn) {
        acc[section.id] = sortTasks(sectionTasks);
      } else if (showReinsertButton) {
        // Needs Attention mode: sort by effective last action time ascending
        acc[section.id] = [...sectionTasks].sort((a, b) =>
          getEffectiveLastActionTime(a).localeCompare(getEffectiveLastActionTime(b))
        );
      } else {
        acc[section.id] = sectionTasks;
      }
    } else {
      const sectionTasks = tasks
        .filter(t => t.sectionId === section.id && !t.parentTaskId);
      if (sortColumn) {
        acc[section.id] = sortTasks(sectionTasks);
      } else if (showReinsertButton) {
        // Needs Attention mode: sort by effective last action time ascending
        acc[section.id] = [...sectionTasks].sort((a, b) =>
          getEffectiveLastActionTime(a).localeCompare(getEffectiveLastActionTime(b))
        );
      } else if (initialSortByProject && !userHasReordered) {
        // Preserve the pre-sorted order from the parent (sorted by project name)
        acc[section.id] = sectionTasks;
      } else {
        acc[section.id] = sectionTasks.sort((a, b) => a.order - b.order);
      }
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const unsectionedTasks = (() => {
    const raw = flatMode
      ? tasks.filter(t => !t.sectionId)
      : tasks.filter(t => !t.sectionId && !t.parentTaskId);
    if (sortColumn) return sortTasks(raw);
    if (showReinsertButton) {
      return [...raw].sort((a, b) =>
        getEffectiveLastActionTime(a).localeCompare(getEffectiveLastActionTime(b))
      );
    }
    return raw;
  })();

  if (tasks.length === 0 && sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Circle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No tasks yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create a task to get started</p>
      </div>
    );
  }

  // Helper to render a column resize handle
  const renderResizeHandle = (columnKey: keyof ColumnWidths) => (
    <div
      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation(); // Don't trigger column drag
        const startX = e.clientX;
        const startWidth = columnWidths[columnKey] || 128;
        const handleMouseMove = (moveEvent: MouseEvent) => {
          const diff = moveEvent.clientX - startX;
          const newWidth = Math.max(minColumnWidths[columnKey as keyof ColumnWidths] || 100, startWidth + diff);
          handleColumnResize(columnKey, newWidth);
        };
        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }}
    />
  );

  // Number of visible data columns (excluding name)
  const dataColCount = visibleColumns.length;

  // Stable string key for column order - used to force TaskRow re-mount on reorder
  const columnOrderKey = visibleColumns.join(',');

  // Render sort indicator icon for a column
  const renderSortIcon = (colId: string) => {
    if (sortColumn === colId) {
      return sortDirection === 'asc'
        ? <ArrowUp className="h-3 w-3 flex-shrink-0" />
        : <ArrowDown className="h-3 w-3 flex-shrink-0" />;
    }
    return <ArrowUpDown className="h-3 w-3 flex-shrink-0 opacity-0 group-hover/th:opacity-50" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: columnWidths.name }} />
            {visibleColumns.map(colId => (
              <col key={colId} style={{ width: columnWidths[colId] || 128 }} />
            ))}
          </colgroup>

          {/* Column Headers - Name is fixed, others are draggable */}
          <thead className="sticky top-0 z-20 bg-background border-b">
            <tr className="border-b">
              {/* Name column header - always first, not draggable */}
              <th className="p-2 text-left text-sm font-medium border-r relative bg-muted sticky left-0 z-30 group/th">
                <div className="flex items-center justify-between pr-2 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  <span>Name</span>
                  {renderSortIcon('name')}
                </div>
                {renderResizeHandle('name')}
              </th>
              {/* Draggable data column headers */}
              {visibleColumns.map((colId, idx) => (
                <th
                  key={colId}
                  className={cn(
                    "p-2 text-left text-sm font-medium relative bg-muted/50 select-none group/th",
                    idx < visibleColumns.length - 1 && "border-r",
                    draggedColumnId === colId && "opacity-50",
                    dragOverColumnId === colId && "ring-2 ring-primary ring-inset"
                  )}
                  draggable
                  onDragStart={(e) => handleColumnDragStart(e, colId)}
                  onDragOver={(e) => handleColumnDragOver(e, colId)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={(e) => handleColumnDrop(e, colId)}
                  onDragEnd={handleColumnDragEnd}
                >
                  <div className="flex items-center justify-between pr-2 cursor-pointer" onClick={() => toggleSort(colId)}>
                    <span>{COLUMN_LABELS[colId]}</span>
                    {renderSortIcon(colId)}
                  </div>
                  {renderResizeHandle(colId as keyof ColumnWidths)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Render sections */}
            {sections.sort((a, b) => a.order - b.order).map(section => {
              const sectionTasks = tasksBySection[section.id] || [];

              return (
                <React.Fragment key={section.id}>
                  {/* Section Header Row */}
                  <tr 
                    className={`
                      group border-b
                      ${draggedSectionId === section.id ? 'opacity-50' : ''}
                      ${dragOverSectionId === section.id ? 'ring-2 ring-primary' : ''}
                    `}
                    draggable={true}
                    onDragStart={(e) => handleSectionDragStart(e, section.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedSectionId && draggedSectionId !== section.id) {
                        setDragOverSectionId(section.id);
                      }
                    }}
                    onDragLeave={handleSectionDragLeave}
                    onDrop={(e) => handleSectionDrop(e, section.id)}
                    onDragEnd={handleSectionDragEnd}
                  >
                    <td className="pt-6 pb-3 px-3 sticky left-0 z-10 bg-background">
                      <div className="flex items-center gap-2">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <button
                          onClick={() => toggleSectionCollapsed(section.id)}
                          className="text-left hover:opacity-80 flex-shrink-0"
                        >
                          {section.collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <InlineEditable
                          value={section.name}
                          onSave={(newName) => handleRenameSection(section.id, newName)}
                          validate={validateSectionName}
                          placeholder="Section name"
                          displayClassName="font-semibold truncate"
                          inputClassName="font-semibold"
                        />
                        <Badge variant="secondary" className="flex-shrink-0">
                          {sectionTasks.length}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(section.id);
                          }}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Delete section"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    {visibleColumns.map(colId => (
                      <td key={colId} className="bg-background"></td>
                    ))}
                  </tr>

                  {/* Section Tasks */}
                  {!section.collapsed && sectionTasks.length > 0 && sectionTasks.map(task => (
                    <TaskRow
                      key={`${task.id}-${columnOrderKey}`}
                      task={task}
                      onComplete={handleTaskComplete}
                      onClick={onTaskClick}
                      onViewSubtasks={handleViewSubtasks}
                      onSubtaskButtonClick={onSubtaskButtonClick}
                      onAddSubtask={onAddSubtask}
                      draggable={!showReinsertButton}
                      onDragStart={handleDragStart}
                      onDragOver={handleTaskDragOver}
                      onDragLeave={handleTaskDragLeave}
                      onDrop={handleTaskDrop}
                      draggedTaskId={draggedTaskId}
                      dragOverTaskId={dragOverTaskId}
                      isSelected={selectedTaskId === task.id}
                      depth={0}
                      taskWasExpanded={taskWasExpanded}
                      onSetTaskWasExpanded={setTaskWasExpanded}
                      showProjectColumn={showProjectColumn}
                      projectName={showProjectColumn ? getProjectName(task) : undefined}
                      onProjectClick={onProjectClick}
                      flatMode={flatMode}
                      columnOrder={visibleColumns}
                      showReinsertButton={showReinsertButton}
                      onReinsert={onReinsert}
                      hideCompletedSubtasks={hideCompletedSubtasks}
                    />
                  ))}

                  {/* Add Task Button Row */}
                  {!section.collapsed && (
                    <tr 
                      className={cn(
                        "hover:bg-accent cursor-pointer transition-colors",
                        draggedTaskId && sectionTasks.length === 0 && "bg-accent/50"
                      )}
                      onClick={() => handleAddTask(section.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedTaskId && sectionTasks.length === 0) {
                          setDragOverTaskId(`section-${section.id}`);
                        }
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        if (draggedTaskId && sectionTasks.length === 0) {
                          setDragOverTaskId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverTaskId(null);
                        if (draggedTaskId && sectionTasks.length === 0) {
                          updateTask(draggedTaskId, { sectionId: section.id, order: 0 });
                          setDraggedTaskId(null);
                        }
                      }}
                    >
                      <td className="p-2 sticky left-0 z-10 bg-background hover:bg-accent transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-4 flex-shrink-0" />
                          <div className="w-4 flex-shrink-0" />
                          <div className="w-5 flex-shrink-0" />
                          <span className="text-muted-foreground hover:text-foreground">Add tasks...</span>
                        </div>
                      </td>
                      {visibleColumns.map(colId => (
                        <td key={colId}></td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Render unsectioned tasks */}
            {unsectionedTasks.length > 0 && (
              <>
                <tr className="bg-muted/50">
                  <td className="p-3 text-sm font-semibold text-muted-foreground uppercase border-r sticky left-0 z-10 bg-muted/50">
                    Unsectioned
                  </td>
                  {visibleColumns.map((colId, i) => (
                    <td key={colId} className={cn("bg-muted/50", i < visibleColumns.length - 1 && "border-r")}></td>
                  ))}
                </tr>
                {unsectionedTasks.map(task => (
                  <TaskRow
                    key={`${task.id}-${columnOrderKey}`}
                    task={task}
                    onComplete={handleTaskComplete}
                    onClick={onTaskClick}
                    onViewSubtasks={handleViewSubtasks}
                    onSubtaskButtonClick={onSubtaskButtonClick}
                    onAddSubtask={onAddSubtask}
                    draggable={!showReinsertButton}
                    onDragStart={handleDragStart}
                    onDragOver={handleTaskDragOver}
                    onDragLeave={handleTaskDragLeave}
                    onDrop={handleTaskDrop}
                    draggedTaskId={draggedTaskId}
                    dragOverTaskId={dragOverTaskId}
                    isSelected={selectedTaskId === task.id}
                    depth={0}
                    taskWasExpanded={taskWasExpanded}
                    onSetTaskWasExpanded={setTaskWasExpanded}
                    showProjectColumn={showProjectColumn}
                    projectName={showProjectColumn ? getProjectName(task) : undefined}
                    onProjectClick={onProjectClick}
                    flatMode={flatMode}
                    columnOrder={visibleColumns}
                    showReinsertButton={showReinsertButton}
                    onReinsert={onReinsert}
                    hideCompletedSubtasks={hideCompletedSubtasks}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>

        {/* Add Section Button */}
        <div className="mt-4">
          {isAddingSection ? (
            <div className="flex gap-2">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') handleCancelAddSection();
                }}
                placeholder="Section name"
                autoFocus
              />
              <Button onClick={handleAddSection} disabled={!newSectionName.trim()}>
                Add
              </Button>
              <Button variant="ghost" onClick={handleCancelAddSection}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setIsAddingSection(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          )}
        </div>
      </div>

      {/* Delete Section Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section?
              {sectionToDelete && tasksBySection[sectionToDelete]?.length > 0 && (
                <span className="block mt-2 font-semibold text-destructive">
                  This section has {tasksBySection[sectionToDelete].length} task{tasksBySection[sectionToDelete].length > 1 ? 's' : ''} that will be moved to the first section.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteSection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
