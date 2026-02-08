'use client';

import React from 'react';
import { Circle, ChevronRight, ChevronDown, MoreVertical, Plus, GripVertical } from 'lucide-react';
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
import { useState } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateSectionName } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { TaskRow } from '@/components/TaskRow';
import { cn } from '@/lib/utils';

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
}

interface ColumnWidths {
  name: number;
  dueDate: number;
  priority: number;
  assignee: number;
  tags: number;
}

/**
 * List view component for displaying tasks grouped by collapsible sections
 * with table-like task rows
 */
export function TaskList({ tasks, sections, onTaskClick, onTaskComplete, onAddTask, onViewSubtasks, onSubtaskButtonClick, onAddSubtask, selectedTaskId }: TaskListProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [sectionWasExpanded, setSectionWasExpanded] = useState<boolean>(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const { updateTask, updateSection, deleteSection, addSection } = useDataStore();

  // Calculate minimum column widths based on content
  const calculateMinWidths = (): ColumnWidths => {
    // Base minimum widths for headers and UI elements
    const minWidths: ColumnWidths = {
      name: 200, // Minimum for task name with icons
      dueDate: 100, // Minimum for date display
      priority: 80, // Minimum for priority badge
      assignee: 100, // Minimum for assignee name
      tags: 120 // Minimum for tags
    };

    // Calculate actual content widths (rough estimation)
    tasks.forEach(task => {
      // Estimate name width (characters * 8px + icons ~100px)
      const nameWidth = Math.min(400, task.description.length * 8 + 100);
      minWidths.name = Math.max(minWidths.name, nameWidth);

      // Estimate assignee width
      if (task.assignee) {
        const assigneeWidth = Math.min(200, task.assignee.length * 8 + 20);
        minWidths.assignee = Math.max(minWidths.assignee, assigneeWidth);
      }

      // Estimate tags width
      if (task.tags.length > 0) {
        const tagsWidth = Math.min(300, task.tags.length * 60);
        minWidths.tags = Math.max(minWidths.tags, tagsWidth);
      }
    });

    return minWidths;
  };

  const minColumnWidths = calculateMinWidths();

  // Column width state
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    name: Math.max(300, minColumnWidths.name),
    dueDate: Math.max(128, minColumnWidths.dueDate),
    priority: Math.max(96, minColumnWidths.priority),
    assignee: Math.max(128, minColumnWidths.assignee),
    tags: Math.max(160, minColumnWidths.tags)
  });

  const handleColumnResize = (column: keyof ColumnWidths, width: number) => {
    // Enforce minimum width based on content
    const minWidth = minColumnWidths[column];
    const constrainedWidth = Math.max(minWidth, width);
    
    setColumnWidths(prev => ({
      ...prev,
      [column]: constrainedWidth
    }));
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
      // Fallback to regular click if onViewSubtasks not provided
      onTaskClick(taskId);
    }
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      updateSection(sectionId, { collapsed: !section.collapsed });
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
    const projectId = sections[0]?.projectId;
    if (!projectId || !newSectionName.trim()) return;

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

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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

    // CRITICAL: Prevent mixing subtasks with top-level tasks or subtasks from different parents
    // Both must be top-level tasks OR both must be subtasks of the same parent
    if (draggedTask.parentTaskId !== targetTask.parentTaskId) {
      setDraggedTaskId(null);
      return;
    }
    
    // Handle subtask reordering (both have the same parent)
    if (draggedTask.parentTaskId && targetTask.parentTaskId) {
      // Get all subtasks of the same parent, sorted by order
      const parentSubtasks = tasks
        .filter(t => t.parentTaskId === draggedTask.parentTaskId)
        .sort((a, b) => a.order - b.order);

      // Find indices
      const draggedIndex = parentSubtasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = parentSubtasks.findIndex(t => t.id === targetTaskId);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedTaskId(null);
        return;
      }

      // Reorder subtasks
      const reorderedSubtasks = [...parentSubtasks];
      const [removed] = reorderedSubtasks.splice(draggedIndex, 1);
      reorderedSubtasks.splice(targetIndex, 0, removed);

      // Update order for all affected subtasks
      reorderedSubtasks.forEach((subtask, index) => {
        updateTask(subtask.id, { order: index });
      });

      setDraggedTaskId(null);
      return;
    }

    // Handle top-level task reordering (both have no parent)
    // If moving to a different section, update the section and place at the target position
    if (draggedTask.sectionId !== targetTask.sectionId) {
      // Get all tasks in the target section, sorted by order
      const targetSectionTasks = tasks
        .filter(t => t.sectionId === targetTask.sectionId && !t.parentTaskId && t.id !== draggedTaskId)
        .sort((a, b) => a.order - b.order);

      // Find target index
      const targetIndex = targetSectionTasks.findIndex(t => t.id === targetTaskId);
      
      if (targetIndex === -1) {
        setDraggedTaskId(null);
        return;
      }

      // Insert dragged task at target position
      targetSectionTasks.splice(targetIndex, 0, draggedTask);

      // Update section and order for dragged task
      updateTask(draggedTaskId, { 
        sectionId: targetTask.sectionId,
        order: targetIndex
      });

      // Update order for all tasks after the insertion point
      targetSectionTasks.forEach((task, index) => {
        if (task.id !== draggedTaskId) {
          updateTask(task.id, { order: index });
        }
      });
    } else {
      // Reordering within the same section
      const sectionTasks = tasks
        .filter(t => t.sectionId === draggedTask.sectionId && !t.parentTaskId)
        .sort((a, b) => a.order - b.order);

      // Find indices
      const draggedIndex = sectionTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = sectionTasks.findIndex(t => t.id === targetTaskId);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedTaskId(null);
        return;
      }

      // Reorder tasks
      const reorderedTasks = [...sectionTasks];
      const [removed] = reorderedTasks.splice(draggedIndex, 1);
      reorderedTasks.splice(targetIndex, 0, removed);

      // Update order for all affected tasks
      reorderedTasks.forEach((task, index) => {
        updateTask(task.id, { order: index });
      });
    }

    setDraggedTaskId(null);
  };

  const handleDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask(draggedTaskId, { sectionId });
      setDraggedTaskId(null);
    }
  };

  // Section drag-and-drop handlers
  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      // Remember if section was expanded
      setSectionWasExpanded(!section.collapsed);
      
      // Collapse the section if it was expanded
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
    // Restore expanded state if drag was cancelled (no drop occurred)
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
      // Restore expanded state if drag was cancelled or invalid
      if (draggedSectionId && sectionWasExpanded) {
        updateSection(draggedSectionId, { collapsed: false });
      }
      setDraggedSectionId(null);
      setSectionWasExpanded(false);
      return;
    }

    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    // Find indices
    const draggedIndex = sortedSections.findIndex(s => s.id === draggedSectionId);
    const targetIndex = sortedSections.findIndex(s => s.id === targetSectionId);

    if (draggedIndex === -1 || targetIndex === -1) {
      // Restore expanded state if drag failed
      if (sectionWasExpanded) {
        updateSection(draggedSectionId, { collapsed: false });
      }
      setDraggedSectionId(null);
      setSectionWasExpanded(false);
      return;
    }

    // Reorder sections
    const reorderedSections = [...sortedSections];
    const [removed] = reorderedSections.splice(draggedIndex, 1);
    reorderedSections.splice(targetIndex, 0, removed);

    // Update order for all sections
    reorderedSections.forEach((section, index) => {
      updateSection(section.id, { order: index });
    });

    // Restore expanded state if section was expanded before drag
    if (sectionWasExpanded) {
      updateSection(draggedSectionId, { collapsed: false });
    }

    setDraggedSectionId(null);
    setSectionWasExpanded(false);
  };

  // Group tasks by section and sort by order
  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = tasks
      .filter(t => t.sectionId === section.id && !t.parentTaskId)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<string, Task[]>);

  // Tasks without section
  const unsectionedTasks = tasks.filter(t => !t.sectionId && !t.parentTaskId);

  if (tasks.length === 0 && sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Circle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No tasks yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create a task to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Single scrollable container for header and all sections */}
      <div className="overflow-x-auto flex-1">
        {/* One big table containing everything */}
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: columnWidths.name }} />
            <col style={{ width: columnWidths.dueDate }} />
            <col style={{ width: columnWidths.priority }} />
            <col style={{ width: columnWidths.assignee }} />
            <col style={{ width: columnWidths.tags }} />
          </colgroup>

          {/* Frozen Column Header */}
          <thead className="sticky top-0 z-20 bg-background border-b">
            <tr className="border-b">
              <th className="p-2 text-left text-sm font-medium border-r relative bg-muted sticky left-0 z-30">
                Name
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = columnWidths.name;
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const diff = moveEvent.clientX - startX;
                      const newWidth = Math.max(minColumnWidths.name, startWidth + diff);
                      handleColumnResize('name', newWidth);
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </th>
              <th className="p-2 text-left text-sm font-medium border-r relative bg-muted/50">
                Due date
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = columnWidths.dueDate;
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const diff = moveEvent.clientX - startX;
                      const newWidth = Math.max(minColumnWidths.dueDate, startWidth + diff);
                      handleColumnResize('dueDate', newWidth);
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </th>
              <th className="p-2 text-left text-sm font-medium border-r relative bg-muted/50">
                Priority
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = columnWidths.priority;
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const diff = moveEvent.clientX - startX;
                      const newWidth = Math.max(minColumnWidths.priority, startWidth + diff);
                      handleColumnResize('priority', newWidth);
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </th>
              <th className="p-2 text-left text-sm font-medium border-r relative bg-muted/50">
                Assignee
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = columnWidths.assignee;
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const diff = moveEvent.clientX - startX;
                      const newWidth = Math.max(minColumnWidths.assignee, startWidth + diff);
                      handleColumnResize('assignee', newWidth);
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </th>
              <th className="p-2 text-left text-sm font-medium relative bg-muted/50">
                Tags
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = columnWidths.tags;
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const diff = moveEvent.clientX - startX;
                      const newWidth = Math.max(minColumnWidths.tags, startWidth + diff);
                      handleColumnResize('tags', newWidth);
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </th>
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
                    <td className="bg-background"></td>
                    <td className="bg-background"></td>
                    <td className="bg-background"></td>
                    <td className="bg-background"></td>
                  </tr>

                  {/* Section Tasks */}
                  {!section.collapsed && sectionTasks.length > 0 && sectionTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={handleTaskComplete}
                      onClick={onTaskClick}
                      onViewSubtasks={handleViewSubtasks}
                      onSubtaskButtonClick={onSubtaskButtonClick}
                      onAddSubtask={onAddSubtask}
                      draggable
                      onDragStart={handleDragStart}
                      onDragOver={handleTaskDragOver}
                      onDragLeave={handleTaskDragLeave}
                      onDrop={handleTaskDrop}
                      draggedTaskId={draggedTaskId}
                      dragOverTaskId={dragOverTaskId}
                      isSelected={selectedTaskId === task.id}
                      depth={0}
                    />
                  ))}

                  {/* Add Task Button Row - also serves as drop zone for empty sections */}
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
                        // Allow dropping on empty section via Add tasks row
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
                          // Move task to this empty section
                          updateTask(draggedTaskId, { 
                            sectionId: section.id,
                            order: 0
                          });
                          setDraggedTaskId(null);
                        }
                      }}
                    >
                      <td className="p-2 sticky left-0 z-10 bg-background hover:bg-accent transition-colors">
                        <div className="flex items-center gap-2">
                          {/* Spacing to align with task name - matches drag handle + expand/collapse + checkbox widths */}
                          <div className="w-4 flex-shrink-0" />
                          <div className="w-4 flex-shrink-0" />
                          <div className="w-5 flex-shrink-0" />
                          <span className="text-muted-foreground hover:text-foreground">Add tasks...</span>
                        </div>
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
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
                  <td className="border-r bg-muted/50"></td>
                  <td className="border-r bg-muted/50"></td>
                  <td className="border-r bg-muted/50"></td>
                  <td className="bg-muted/50"></td>
                </tr>
                {unsectionedTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleTaskComplete}
                    onClick={onTaskClick}
                    onViewSubtasks={handleViewSubtasks}
                    onSubtaskButtonClick={onSubtaskButtonClick}
                    onAddSubtask={onAddSubtask}
                    isSelected={selectedTaskId === task.id}
                    depth={0}
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
