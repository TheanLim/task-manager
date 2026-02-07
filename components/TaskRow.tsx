'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, Calendar, GripVertical, X } from 'lucide-react';
import { Task, Priority } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDataStore } from '@/stores/dataStore';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';

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
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const { getSubtasks, updateTask } = useDataStore();
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

  const handleAddTag = () => {
    if (tagInput.trim() && !task.tags.includes(tagInput.trim())) {
      updateTask(task.id, { tags: [...task.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateTask(task.id, { tags: task.tags.filter(t => t !== tagToRemove) });
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
        <td className="p-1 border-r sticky left-0 bg-background group-hover:bg-accent z-10 relative transition-colors">
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
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <InlineEditable
                value={task.description}
                onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
                validate={validateTaskDescription}
                placeholder="Task description"
                displayClassName={cn(
                  "truncate",
                  task.completed && "line-through text-muted-foreground"
                )}
                inputClassName="w-full"
              />
            </div>

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
        <td 
          className="p-1 border-r text-sm text-muted-foreground cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-1 hover:bg-accent rounded px-1 py-0.5">
                {task.dueDate ? (
                  <>
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(task.dueDate), 'MMM d')}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/50">Set date</span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={task.dueDate ? new Date(task.dueDate) : undefined}
                onSelect={(date) => {
                  updateTask(task.id, { dueDate: date?.toISOString() || null });
                }}
                initialFocus
              />
              {task.dueDate && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => updateTask(task.id, { dueDate: null })}
                  >
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </td>

        {/* Priority Column */}
        <td 
          className="p-1 border-r cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <Select
            value={task.priority}
            onValueChange={(value) => updateTask(task.id, { priority: value as Priority })}
          >
            <SelectTrigger className="h-6 border-0 shadow-none hover:bg-accent">
              <SelectValue>
                {task.priority !== Priority.NONE ? (
                  <Badge variant={getPriorityVariant(task.priority)} className="text-xs">
                    {task.priority}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground/50">Priority</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Priority.NONE}>None</SelectItem>
              <SelectItem value={Priority.LOW}>Low</SelectItem>
              <SelectItem value={Priority.MEDIUM}>Medium</SelectItem>
              <SelectItem value={Priority.HIGH}>High</SelectItem>
            </SelectContent>
          </Select>
        </td>

        {/* Assignee Column */}
        <td 
          className="p-1 border-r text-sm text-muted-foreground truncate cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <InlineEditable
            value={task.assignee || ''}
            onSave={(newAssignee) => updateTask(task.id, { assignee: newAssignee || null })}
            placeholder="Assignee"
            displayClassName="truncate text-sm"
            inputClassName="w-full text-sm"
          />
        </td>

        {/* Tags Column */}
        <td 
          className="p-1 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <Popover open={isEditingTags} onOpenChange={setIsEditingTags}>
            <PopoverTrigger asChild>
              <div className="flex gap-1 flex-wrap hover:bg-accent rounded px-1 py-0.5 min-h-[24px]">
                {task.tags.length > 0 ? (
                  <>
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
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/50">Add tags</span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleAddTag} disabled={!tagInput.trim()}>
                    Add
                  </Button>
                </div>
                {task.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
