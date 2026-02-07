'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, Calendar, GripVertical } from 'lucide-react';
import { Task, Priority } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDataStore } from '@/stores/dataStore';

interface TaskRowProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onClick: (taskId: string) => void;
  onViewSubtasks: (taskId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  depth?: number;
  isSelected?: boolean;
}

/**
 * TaskRow component displays a single task in a table-like row format
 * with configurable columns and interactive elements
 */
export function TaskRow({
  task,
  onComplete,
  onClick,
  onViewSubtasks,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging = false,
  isDragOver = false,
  depth = 0,
  isSelected = false
}: TaskRowProps) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const { getSubtasks } = useDataStore();
  const subtasks = getSubtasks(task.id);
  const hasSubtasks = subtasks.length > 0;

  const getPriorityVariant = (priority: Priority): 'default' | 'destructive' | 'secondary' | 'outline' => {
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

  return (
    <>
      {/* Main Task Row */}
      <tr
        className={cn(
          "border-b hover:bg-accent group transition-colors",
          task.completed && "opacity-60",
          isDragging && "opacity-50",
          isDragOver && "ring-2 ring-primary"
        )}
        draggable={draggable && depth === 0}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Task Name Column - contains drag handle, expand/collapse, checkbox, name, and chevron-right */}
        <td className="p-2 border-r sticky left-0 bg-background group-hover:bg-accent z-10 relative transition-colors">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth > 0 ? `${depth * 24}px` : 0 }}>
            {/* Drag Handle - appears on hover */}
            {draggable && depth === 0 && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            
            {/* Expand/Collapse Subtasks Button */}
            {hasSubtasks ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSubtasksExpanded(!subtasksExpanded);
                }}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={subtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                {subtasksExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}

            {/* Completion Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task.id);
              }}
              className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                task.completed
                  ? "bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              )}
              aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {task.completed && <Check className="h-3 w-3 text-white" />}
            </button>

            {/* Task Name */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClick(task.id);
              }}
              className={cn(
                "cursor-pointer hover:underline truncate flex-1",
                task.completed && "line-through text-muted-foreground"
              )}
              title={task.description}
            >
              {task.description}
            </span>

            {/* Chevron Right - appears on hover, hidden when selected */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClick(task.id);
              }}
              className={cn(
                "h-8 w-8 p-0 transition-opacity flex-shrink-0 absolute right-3",
                isSelected ? "opacity-0" : "opacity-0 group-hover:opacity-100"
              )}
              aria-label="View details"
              title="View details"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </td>

        {/* Due Date Column */}
        <td className="p-2 border-r text-sm text-muted-foreground">
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), 'MMM d')}</span>
            </div>
          )}
        </td>

        {/* Priority Column */}
        <td className="p-2 border-r">
          {task.priority !== Priority.NONE && (
            <Badge variant={getPriorityVariant(task.priority)}>
              {task.priority}
            </Badge>
          )}
        </td>

        {/* Assignee Column */}
        <td className="p-2 border-r text-sm text-muted-foreground truncate" title={task.assignee || ''}>
          {task.assignee}
        </td>

        {/* Tags Column */}
        <td className="p-2">
          {task.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {task.tags.slice(0, 2).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Subtasks (if expanded) */}
      {hasSubtasks && subtasksExpanded && (
        <>
          {subtasks.map(subtask => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              onComplete={onComplete}
              onClick={onClick}
              onViewSubtasks={onViewSubtasks}
              depth={depth + 1}
              isSelected={isSelected}
            />
          ))}
        </>
      )}
    </>
  );
}
