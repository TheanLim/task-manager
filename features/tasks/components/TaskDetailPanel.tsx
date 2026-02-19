'use client';

import { Task, UUID, Priority } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DatePickerPopover } from '@/features/tasks/components/DatePickerPopover';
import { TagEditorPopover } from '@/features/tasks/components/TagEditorPopover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DependencyList } from '@/features/tasks/components/DependencyList';
import { RichTextEditor } from '@/features/tasks/components/RichTextEditor';
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
import {
  Calendar,
  Tag,
  User,
  Trash2,
  Plus,
  CheckCircle2,
  ChevronsRight,
  Maximize2,
  Minimize2,
  GripVertical,
  Check,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import { cn } from '@/lib/utils';
import { getPriorityVariant } from '@/features/tasks/services/priorityUtils';

interface TaskDetailPanelProps {
  task: Task;
  parentTask?: Task | null;
  subtasks: Task[];
  blockingTasks: Task[];
  blockedTasks: Task[];
  onDelete: () => void;
  onClose: () => void;
  onComplete: (completed: boolean) => void;
  onExpand: () => void;
  onAddSubtask: () => void;
  onAddDependency: () => void;
  onRemoveDependency: (blockingTaskId: UUID, blockedTaskId: UUID) => void;
  onSubtaskClick: (taskId: string) => void;
  isExpanded?: boolean;
  scrollToSubtasks?: boolean;
}

/**
 * Panel to display full task details with inline editing
 */
export function TaskDetailPanel({
  task,
  parentTask,
  subtasks,
  blockingTasks,
  blockedTasks,
  onDelete,
  onClose,
  onComplete,
  onExpand,
  onAddSubtask,
  onAddDependency,
  onRemoveDependency,
  onSubtaskClick,
  isExpanded = false,
  scrollToSubtasks = false
}: TaskDetailPanelProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notes);
  const subtasksRef = useRef<HTMLDivElement>(null);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null);
  
  const { updateTask } = useDataStore();

  // Sync notesValue when task changes
  useEffect(() => {
    setNotesValue(task.notes);
    setIsEditingNotes(false);
  }, [task.id, task.notes]);

  // Scroll to subtasks section when requested
  useEffect(() => {
    if (scrollToSubtasks && subtasksRef.current) {
      setTimeout(() => {
        subtasksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [scrollToSubtasks]);

  const handleSaveNotes = () => {
    if (notesValue !== task.notes) {
      updateTask(task.id, { notes: notesValue });
    }
    setIsEditingNotes(false);
  };

  const handleCancelNotes = () => {
    setNotesValue(task.notes);
    setIsEditingNotes(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    onDelete();
  };

  // Drag and drop handlers for subtasks
  const handleSubtaskDragStart = (e: React.DragEvent, subtaskId: string) => {
    setDraggedSubtaskId(subtaskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubtaskDragOver = (e: React.DragEvent, subtaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedSubtaskId && draggedSubtaskId !== subtaskId) {
      setDragOverSubtaskId(subtaskId);
    }
  };

  const handleSubtaskDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSubtaskId(null);
  };

  const handleSubtaskDrop = (e: React.DragEvent, targetSubtaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubtaskId(null);

    if (!draggedSubtaskId || draggedSubtaskId === targetSubtaskId) {
      setDraggedSubtaskId(null);
      return;
    }

    // Find indices
    const draggedIndex = subtasks.findIndex(s => s.id === draggedSubtaskId);
    const targetIndex = subtasks.findIndex(s => s.id === targetSubtaskId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedSubtaskId(null);
      return;
    }

    // Reorder subtasks
    const reorderedSubtasks = [...subtasks];
    const [removed] = reorderedSubtasks.splice(draggedIndex, 1);
    reorderedSubtasks.splice(targetIndex, 0, removed);

    // Update order for all affected subtasks
    reorderedSubtasks.forEach((subtask, index) => {
      updateTask(subtask.id, { order: index });
    });

    setDraggedSubtaskId(null);
  };

  return (
    <>
      <TooltipProvider>
        <div className="space-y-6">
        {/* Status Strip */}
        <div className={cn(
          "h-1 rounded-full",
          task.completed
            ? "bg-green-500"
            : task.dueDate && !task.completed && new Date(task.dueDate) < new Date()
              ? "bg-destructive"
              : task.dueDate
                ? "bg-accent-brand"
                : "bg-muted"
        )}>
          <span className="sr-only">
            {task.completed
              ? "Status: Completed"
              : task.dueDate && new Date(task.dueDate) < new Date()
                ? "Status: Overdue"
                : task.dueDate
                  ? "Status: In progress"
                  : "Status: No status"}
          </span>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-2">
          {/* Completion Button - Left */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onComplete(!task.completed)}
                className={`${
                  task.completed
                    ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border-2 border-green-500'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
                size="sm"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {task.completed ? 'Completed' : 'Mark Complete'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{task.completed ? "Mark as incomplete" : "Mark as complete"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Action Buttons - Right */}
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onExpand}>
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isExpanded ? "Collapse to sidebar" : "Expand to full page"}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleDeleteClick}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete task</p>
              </TooltipContent>
            </Tooltip>
            
            {!isExpanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onClose}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close panel</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

      <Separator />

      {/* Header */}
      <div>
        {/* Breadcrumb for subtasks */}
        {parentTask && (
          <div className="mb-2 text-xs text-muted-foreground">
            <button
              onClick={() => onSubtaskClick(parentTask.id)}
              className="hover:text-foreground hover:underline transition-colors"
            >
              {parentTask.description}
            </button>
            <span className="mx-1">&gt;</span>
            <span>{task.description}</span>
          </div>
        )}
        
        <InlineEditable
          value={task.description}
          onSave={(newDescription) => {
            updateTask(task.id, { description: newDescription });
          }}
          validate={validateTaskDescription}
          placeholder="Task description"
          displayClassName="text-2xl font-bold"
          inputClassName="text-2xl font-bold"
        />
        {task.completed && task.completedAt && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Completed {format(new Date(task.completedAt), 'PPP')}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Properties */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        {/* Priority */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Priority:</span>
          <Select
            value={task.priority}
            onValueChange={(value) => {
              updateTask(task.id, { priority: value as Priority });
            }}
          >
            <SelectTrigger className="h-7 w-32 border-0 shadow-none hover:bg-accent">
              <SelectValue>
                {task.priority !== Priority.NONE ? (
                  <Badge variant={getPriorityVariant(task.priority)} className="text-xs">
                    {task.priority}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No priority</span>
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
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <DatePickerPopover
            value={task.dueDate}
            onChange={(date) => updateTask(task.id, { dueDate: date })}
            align="start"
            trigger={
              <div className="cursor-pointer hover:bg-accent rounded px-2 py-1 -mx-2">
                {task.dueDate ? (
                  <span>Due {format(new Date(task.dueDate), 'PPP')}</span>
                ) : (
                  <span className="text-muted-foreground italic">No due date</span>
                )}
              </div>
            }
          />
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <InlineEditable
            value={task.assignee || ''}
            onSave={(newAssignee) => {
              updateTask(task.id, { assignee: newAssignee || '' });
            }}
            placeholder="No assignee"
            displayClassName="text-sm"
            inputClassName="text-sm"
          />
        </div>

        {/* Tags */}
        <div className="flex items-start gap-2">
          <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
          <TagEditorPopover
            tags={task.tags}
            onAddTag={(tag) => updateTask(task.id, { tags: [...task.tags, tag] })}
            onRemoveTag={(tagToRemove) => updateTask(task.id, { tags: task.tags.filter(t => t !== tagToRemove) })}
            trigger={
              <div className="flex flex-wrap gap-2 cursor-pointer hover:bg-accent rounded px-2 py-1 -mx-2 min-h-[28px]">
                {task.tags.length > 0 ? (
                  task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic text-sm">No tags</span>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* Notes */}
      <Separator />
      <div>
        <h3 className="mb-2 text-sm font-semibold">Notes</h3>
        {isEditingNotes ? (
          <div className="space-y-2">
            <RichTextEditor
              value={notesValue}
              onChange={setNotesValue}
              placeholder="Add notes..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveNotes}>Save</Button>
              <Button size="sm" variant="outline" onClick={handleCancelNotes}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingNotes(true)}
            className="cursor-text rounded px-2 py-1 -mx-2 hover:bg-accent transition-colors min-h-[40px]"
          >
            {task.notes ? (
              <RichTextEditor
                value={task.notes}
                onChange={() => {}}
                readOnly
                className="quill-readonly-view"
              />
            ) : (
              <span className="text-muted-foreground italic text-sm">Click to add notes...</span>
            )}
          </div>
        )}
      </div>

      {/* Subtasks */}
      <Separator />
      <div ref={subtasksRef}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Subtasks ({subtasks.length})</h3>
          {task.parentTaskId === null && (
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
        {subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subtasks</p>
        ) : (
          <div className="border-t border-b">
            {subtasks.map((subtask, index) => (
              <div
                key={subtask.id}
                className={cn(
                  "group flex items-center gap-2 py-2 px-3 transition-colors hover:bg-accent cursor-pointer",
                  index !== subtasks.length - 1 && "border-b",
                  draggedSubtaskId === subtask.id && "opacity-50",
                  dragOverSubtaskId === subtask.id && "ring-2 ring-primary"
                )}
                onClick={() => onSubtaskClick(subtask.id)}
                draggable
                onDragStart={(e) => handleSubtaskDragStart(e, subtask.id)}
                onDragOver={(e) => handleSubtaskDragOver(e, subtask.id)}
                onDragLeave={handleSubtaskDragLeave}
                onDrop={(e) => handleSubtaskDrop(e, subtask.id)}
              >
                {/* Left side: Drag handle (on hover), checkbox, and task name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Drag Handle - appears on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTask(subtask.id, { 
                        completed: !subtask.completed,
                        completedAt: !subtask.completed ? new Date().toISOString() : null
                      });
                    }}
                    className={cn(
                      "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                      subtask.completed
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 dark:border-gray-600"
                    )}
                  >
                    {subtask.completed && <Check className="h-3 w-3 text-white" />}
                  </button>
                  
                  {/* Task name */}
                  <span className={cn(
                    "text-sm truncate",
                    subtask.completed && "line-through text-muted-foreground"
                  )}>
                    {subtask.description}
                  </span>
                </div>

                {/* Right side: Due date and chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Due date - show icon only when no date, show date only when set */}
                  <DatePickerPopover
                    value={subtask.dueDate}
                    onChange={(date) => updateTask(subtask.id, { dueDate: date })}
                    align="end"
                    onTriggerClick={(e) => e.stopPropagation()}
                    trigger={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {subtask.dueDate ? (
                          <span>{format(new Date(subtask.dueDate), 'MMM d')}</span>
                        ) : (
                          <Calendar className="h-3 w-3" />
                        )}
                      </button>
                    }
                  />
                  
                  {/* Chevron */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dependencies */}
      <Separator />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Dependencies</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onAddDependency}>
                <Plus className="mr-2 h-4 w-4" />
                Add Dependency
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add a task dependency</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <DependencyList
          blockingTasks={blockingTasks}
          blockedTasks={blockedTasks}
          currentTaskId={task.id}
          onRemoveDependency={onRemoveDependency}
        />
      </div>

      {/* Metadata */}
      <Separator />
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Details</summary>
        <div className="mt-2 space-y-1">
          <p>Created {format(new Date(task.createdAt), 'PPP')}</p>
          <p>Updated {format(new Date(task.updatedAt), 'PPP')}</p>
        </div>
      </details>
    </div>
    </TooltipProvider>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{task.description}&rdquo;?
            {subtasks.length > 0 && (
              <span className="block mt-2 font-semibold text-destructive">
                This task has {subtasks.length} subtask{subtasks.length > 1 ? 's' : ''} that will also be deleted.
              </span>
            )}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
