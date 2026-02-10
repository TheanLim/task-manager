'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Check, Calendar, GripVertical, X, ListTree, User, FolderTree, CornerDownRight } from 'lucide-react';
import { Task, Priority } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDataStore } from '@/stores/dataStore';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';

// Extended task type with flat mode metadata
interface TaskWithFlatMetadata extends Task {
  _flatModeParentName?: string;
  _flatModeParentId?: string;
  _flatModeHasSubtasks?: boolean;
  _flatModeSubtaskCount?: number;
}

interface TaskRowProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onClick: (taskId: string) => void;
  onViewSubtasks: (taskId: string) => void;
  onSubtaskButtonClick?: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent, taskId: string) => void;
  onDragLeave?: (e: React.DragEvent, taskId: string) => void;
  onDrop?: (e: React.DragEvent, taskId: string) => void;
  draggedTaskId?: string | null;
  dragOverTaskId?: string | null;
  depth?: number;
  isSelected?: boolean;
  taskWasExpanded?: boolean;
  onSetTaskWasExpanded?: (wasExpanded: boolean) => void;
  showProjectColumn?: boolean; // NEW - show project column
  projectName?: string; // NEW - project name to display
  onProjectClick?: (projectId: string) => void; // NEW - handler for project click
  flatMode?: boolean; // NEW - flat display mode
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
  onSubtaskButtonClick,
  onAddSubtask,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  draggedTaskId = null,
  dragOverTaskId = null,
  depth = 0,
  isSelected = false,
  taskWasExpanded = false,
  onSetTaskWasExpanded,
  showProjectColumn = false,
  projectName,
  onProjectClick,
  flatMode = false
}: TaskRowProps) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const { getSubtasks, updateTask } = useDataStore();
  const subtasks = getSubtasks(task.id);
  const hasSubtasks = subtasks.length > 0;

  // Collapse subtasks when switching to flat mode
  useEffect(() => {
    if (flatMode && subtasksExpanded) {
      setSubtasksExpanded(false);
    }
  }, [flatMode]);

  // Calculate isDragging and isDragOver based on task.id
  const isDragging = draggedTaskId === task.id;
  const isDragOver = dragOverTaskId === task.id;

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
        data-task-id={task.id}
        className={cn(
          "border-b hover:bg-accent group transition-colors",
          task.completed && "opacity-60",
          isDragging && "opacity-50",
          isDragOver && "ring-2 ring-primary"
        )}
        draggable={draggable}
        onDragStart={onDragStart ? (e) => {
          // Remember if task was expanded and collapse it
          if (hasSubtasks && subtasksExpanded) {
            onSetTaskWasExpanded?.(true);
            setSubtasksExpanded(false);
          }
          onDragStart(e, task.id);
        } : undefined}
        onDragOver={onDragOver ? (e) => onDragOver(e, task.id) : undefined}
        onDragLeave={onDragLeave ? (e) => onDragLeave(e, task.id) : undefined}
        onDrop={onDrop ? (e) => {
          onDrop(e, task.id);
          // Restore expanded state after successful drop
          if (hasSubtasks && taskWasExpanded && draggedTaskId === task.id) {
            setSubtasksExpanded(true);
            onSetTaskWasExpanded?.(false);
          }
        } : undefined}
        onDragEnd={(e) => {
          // Restore expanded state if drag was cancelled
          if (hasSubtasks && taskWasExpanded && draggedTaskId === task.id) {
            setSubtasksExpanded(true);
            onSetTaskWasExpanded?.(false);
          }
        }}
      >
        {/* Task Name Column - contains drag handle, expand/collapse, checkbox, name, and chevron-right */}
        <td className="py-1 pr-1 border-r sticky left-0 bg-background group-hover:bg-accent z-10 relative transition-colors">
          <TooltipProvider>
            <div className="flex items-center gap-2" style={{ paddingLeft: depth > 0 ? `${depth * 24 + 4}px` : '4px' }}>
              {/* Drag Handle - appears on hover for all draggable tasks */}
              {draggable ? (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0">
                  <GripVertical className="h-4 w-4" />
                </div>
              ) : (
                <div className="w-4 flex-shrink-0" />
              )}
              
              {/* Expand/Collapse Subtasks Button or Flat Mode Indicator */}
              {flatMode ? (
                // Flat mode: Show indicator icons instead of expand/collapse
                (task as TaskWithFlatMetadata)._flatModeHasSubtasks ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-shrink-0 text-muted-foreground">
                        <FolderTree className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Has {(task as TaskWithFlatMetadata)._flatModeSubtaskCount} subtask{(task as TaskWithFlatMetadata)._flatModeSubtaskCount !== 1 ? 's' : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (task as TaskWithFlatMetadata)._flatModeParentName ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-shrink-0 text-muted-foreground">
                        <CornerDownRight className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Subtask of: {(task as TaskWithFlatMetadata)._flatModeParentName}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="w-4 flex-shrink-0" />
                )
              ) : (
                // Nested mode: Show expand/collapse button
                hasSubtasks ? (
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
                )
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
              <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <InlineEditable
                  value={task.description}
                  onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
                  validate={validateTaskDescription}
                  placeholder="Task description"
                  displayClassName={cn(
                    task.completed && "line-through text-muted-foreground"
                  )}
                />
                
                {/* Flat mode: Show parent task name badge for subtasks */}
                {flatMode && (task as TaskWithFlatMetadata)._flatModeParentName && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className="text-xs text-muted-foreground cursor-pointer hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const parentId = (task as TaskWithFlatMetadata)._flatModeParentId;
                          if (parentId) {
                            // Find the parent task row and scroll to it
                            const parentRow = document.querySelector(`[data-task-id="${parentId}"]`) as HTMLElement;
                            if (parentRow) {
                              parentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              
                              // Add highlight to the row and its sticky column
                              parentRow.classList.add('!bg-primary/20');
                              const stickyCol = parentRow.querySelector('td.sticky') as HTMLElement;
                              if (stickyCol) {
                                stickyCol.classList.add('!bg-primary/20');
                              }
                              
                              // Remove highlight after 2 seconds
                              setTimeout(() => {
                                parentRow.classList.remove('!bg-primary/20');
                                if (stickyCol) {
                                  stickyCol.classList.remove('!bg-primary/20');
                                }
                              }, 2000);
                            }
                          }
                        }}
                      >
                        <CornerDownRight className="h-3 w-3 mr-1" />
                        {(task as TaskWithFlatMetadata)._flatModeParentName}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to jump to parent task</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Subtask count button (nested mode only) */}
                {!flatMode && hasSubtasks && onSubtaskButtonClick && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubtaskButtonClick(task.id);
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
                      >
                        <span>{subtasks.length}</span>
                        <ListTree className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Flat mode: Show subtask count badge for parent tasks */}
                {flatMode && (task as TaskWithFlatMetadata)._flatModeHasSubtasks && (
                  <Badge variant="secondary" className="text-xs">
                    <FolderTree className="h-3 w-3 mr-1" />
                    {(task as TaskWithFlatMetadata)._flatModeSubtaskCount} subtask{(task as TaskWithFlatMetadata)._flatModeSubtaskCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Chevron Right - appears on hover, hidden when selected */}
              <Tooltip>
                <TooltipTrigger asChild>
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
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View details</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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
                  <span>{format(new Date(task.dueDate), 'MMM d')}</span>
                ) : (
                  <Calendar className="h-3 w-3 text-muted-foreground/50" />
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
          <div className="hover:bg-accent rounded px-1 py-0.5">
            <InlineEditable
              value={task.assignee || ''}
              onSave={(newAssignee) => updateTask(task.id, { assignee: newAssignee || undefined })}
              placeholder="Assignee"
              displayClassName="truncate text-sm"
              inputClassName="w-full text-sm"
              displayElement={
                task.assignee ? undefined : (
                  <User className="h-3 w-3 text-muted-foreground/50" />
                )
              }
            />
          </div>
        </td>

        {/* Tags Column */}
        <td 
          className="p-1 border-r cursor-pointer"
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

        {/* Project Column */}
        {showProjectColumn && (
          <td 
            className="p-1 text-sm text-muted-foreground truncate cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (task.projectId && onProjectClick) {
                onProjectClick(task.projectId);
              }
            }}
          >
            <div className={cn(
              "px-1 py-0.5 truncate rounded",
              task.projectId && "hover:bg-accent hover:text-foreground transition-colors"
            )}>
              {projectName || 'No Project'}
            </div>
          </td>
        )}
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
              onSubtaskButtonClick={onSubtaskButtonClick}
              onAddSubtask={onAddSubtask}
              draggable={draggable}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              draggedTaskId={draggedTaskId}
              dragOverTaskId={dragOverTaskId}
              depth={depth + 1}
              isSelected={isSelected}
              taskWasExpanded={taskWasExpanded}
              onSetTaskWasExpanded={onSetTaskWasExpanded}
              showProjectColumn={showProjectColumn}
              projectName={projectName}
              onProjectClick={onProjectClick}
              flatMode={flatMode}
            />
          ))}
          
          {/* Add subtask row */}
          {onAddSubtask && (
            <tr 
              className="border-b hover:bg-accent cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubtask(task.id);
              }}
            >
              <td className="py-1 pr-1 border-r sticky left-0 bg-background hover:bg-accent z-10 transition-colors">
                <div className="flex items-center gap-2" style={{ paddingLeft: `${(depth + 1) * 24 + 4}px` }}>
                  {/* Spacing to align with subtask content */}
                  <div className="w-4 flex-shrink-0" /> {/* Drag handle space */}
                  <div className="w-4 flex-shrink-0" /> {/* Expand/collapse space */}
                  <div className="w-5 flex-shrink-0" /> {/* Checkbox space */}
                  <span className="text-muted-foreground hover:text-foreground text-sm">Add subtask...</span>
                </div>
              </td>
              <td className="border-r"></td>
              <td className="border-r"></td>
              <td className="border-r"></td>
              <td className="border-r"></td>
              {showProjectColumn && <td></td>}
            </tr>
          )}
        </>
      )}
    </>
  );
}
