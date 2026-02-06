'use client';

import { Circle, ChevronRight, ChevronDown, Calendar, Tag, MoreVertical, Plus, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Task, Section, Priority } from '@/types';
import { format } from 'date-fns';
import { useState } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription, validateSectionName } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';

interface TaskListProps {
  tasks: Task[];
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onAddTask: (sectionId: string) => void;
}

/**
 * List view component for displaying tasks grouped by collapsible sections
 */
export function TaskList({ tasks, sections, onTaskClick, onTaskComplete, onAddTask }: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const { updateTask, updateSection, deleteSection, addSection } = useDataStore();

  const toggleTaskExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
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
    if (confirm('Are you sure you want to delete this section? Tasks will be moved to the first section.')) {
      deleteSection(sectionId);
    }
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

  const handleTaskDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
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
    
    if (!draggedTask || !targetTask || draggedTask.sectionId !== targetTask.sectionId) {
      setDraggedTaskId(null);
      return;
    }

    // Get all tasks in the same section, sorted by order
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

  const handleSectionDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSectionId(null);

    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      setDraggedSectionId(null);
      return;
    }

    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    // Find indices
    const draggedIndex = sortedSections.findIndex(s => s.id === draggedSectionId);
    const targetIndex = sortedSections.findIndex(s => s.id === targetSectionId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedSectionId(null);
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

    setDraggedSectionId(null);
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

  const getSubtasks = (parentId: string) => {
    return tasks.filter(t => t.parentTaskId === parentId);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.HIGH:
        return 'destructive';
      case Priority.MEDIUM:
        return 'default';
      case Priority.LOW:
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const renderTask = (task: Task, depth: number = 0) => {
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div key={task.id} style={{ marginLeft: `${depth * 24}px` }}>
        <Card
          className={`
            mb-2 p-3 transition-colors hover:bg-accent cursor-pointer
            ${task.completed ? 'opacity-60' : ''}
            ${draggedTaskId === task.id ? 'opacity-50' : ''}
            ${dragOverTaskId === task.id ? 'ring-2 ring-primary' : ''}
          `}
          draggable={depth === 0}
          onDragStart={(e) => depth === 0 && handleDragStart(e, task.id)}
          onDragOver={(e) => depth === 0 && handleTaskDragOver(e, task.id)}
          onDragLeave={(e) => depth === 0 && handleTaskDragLeave(e)}
          onDrop={(e) => depth === 0 && handleTaskDrop(e, task.id)}
        >
          <div className="flex items-start gap-3">
            {/* Expand/collapse button for tasks with subtasks */}
            {hasSubtasks && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskExpanded(task.id);
                }}
                className="mt-1 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Checkbox */}
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => {
                onTaskComplete(task.id, checked as boolean);
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />

            {/* Task content */}
            <div
              className="flex-1 min-w-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0" onClick={() => onTaskClick(task.id)}>
                  <InlineEditable
                    value={task.description}
                    onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
                    validate={validateTaskDescription}
                    placeholder="Task description"
                    displayClassName={`font-medium ${task.completed ? 'line-through' : ''}`}
                    inputClassName="font-medium w-full"
                  />
                </div>
                
                {/* Priority badge */}
                {task.priority !== Priority.NONE && (
                  <Badge variant={getPriorityColor(task.priority)} className="shrink-0">
                    {task.priority}
                  </Badge>
                )}
              </div>

              {/* Task metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {/* Due date */}
                {task.dueDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {/* Tags */}
                {task.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    <span>{task.tags.join(', ')}</span>
                  </div>
                )}

                {/* Assignee */}
                {task.assignee && (
                  <span>@{task.assignee}</span>
                )}

                {/* Subtask count */}
                {hasSubtasks && (
                  <span>{subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Render subtasks */}
        {hasSubtasks && isExpanded && (
          <div>
            {subtasks.map(subtask => renderTask(subtask, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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
    <div className="space-y-4">
      {/* Render sections */}
      {sections.sort((a, b) => a.order - b.order).map(section => {
        const sectionTasks = tasksBySection[section.id] || [];

        return (
          <div 
            key={section.id} 
            className={`
              border rounded-lg transition-all
              ${draggedSectionId === section.id ? 'opacity-50' : ''}
              ${dragOverSectionId === section.id ? 'ring-2 ring-primary' : ''}
            `}
            draggable
            onDragStart={(e) => handleSectionDragStart(e, section.id)}
            onDragOver={(e) => handleSectionDragOver(e, section.id)}
            onDragLeave={handleSectionDragLeave}
            onDrop={(e) => handleSectionDrop(e, section.id)}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between p-3 bg-muted/50">
              <div className="flex items-center gap-2 flex-1">
                <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <button
                  onClick={() => toggleSectionCollapsed(section.id)}
                  className="flex items-center gap-2 flex-1 text-left hover:opacity-80"
                >
                  {section.collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <InlineEditable
                    value={section.name}
                    onSave={(newName) => handleRenameSection(section.id, newName)}
                    validate={validateSectionName}
                    placeholder="Section name"
                    displayClassName="font-semibold"
                    inputClassName="font-semibold"
                  />
                  <Badge variant="secondary" className="ml-2">
                    {sectionTasks.length}
                  </Badge>
                </button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDeleteSection(section.id)}>
                    Delete Section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Section Content */}
            {!section.collapsed && (
              <div
                className="p-3"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, section.id)}
              >
                {sectionTasks.length > 0 ? (
                  <div>
                    {sectionTasks.map(task => renderTask(task))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tasks in this section
                  </p>
                )}

                {/* Add Task Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground hover:text-foreground mt-2"
                  onClick={() => handleAddTask(section.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add tasks...
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Render unsectioned tasks */}
      {unsectionedTasks.length > 0 && (
        <div className="border rounded-lg p-3">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase">
            Unsectioned
          </h3>
          <div>
            {unsectionedTasks.map(task => renderTask(task))}
          </div>
        </div>
      )}

      {/* Add Section Button / Input */}
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
  );
}
