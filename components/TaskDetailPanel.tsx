'use client';

import { Task, UUID, Priority } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DependencyList } from '@/components/DependencyList';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';

interface TaskDetailPanelProps {
  task: Task;
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
}

/**
 * Panel to display full task details with inline editing
 */
export function TaskDetailPanel({
  task,
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
  isExpanded = false
}: TaskDetailPanelProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notes);
  
  const { updateTask } = useDataStore();

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

  return (
    <>
      <TooltipProvider>
        <div className="space-y-6">
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
      <div className="space-y-4">
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
          <Popover>
            <PopoverTrigger asChild>
              <div className="cursor-pointer hover:bg-accent rounded px-2 py-1 -mx-2">
                {task.dueDate ? (
                  <span>Due {format(new Date(task.dueDate), 'PPP')}</span>
                ) : (
                  <span className="text-muted-foreground italic">No due date</span>
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
                    onClick={() => {
                      updateTask(task.id, { dueDate: null });
                    }}
                  >
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
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
          <Popover open={isEditingTags} onOpenChange={setIsEditingTags}>
            <PopoverTrigger asChild>
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
        </div>
      </div>

      {/* Notes */}
      <Separator />
      <div>
        <h3 className="mb-2 text-sm font-semibold">Notes</h3>
        {isEditingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSaveNotes();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelNotes();
                }
              }}
              placeholder="No notes"
              className="min-h-[100px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveNotes}>Save</Button>
              <Button size="sm" variant="outline" onClick={handleCancelNotes}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to save, Escape to cancel
            </p>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingNotes(true)}
            className="cursor-text rounded px-2 py-1 -mx-2 hover:bg-accent transition-colors"
          >
            {task.notes ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
            ) : (
              <span className="text-muted-foreground italic text-sm">No notes</span>
            )}
          </div>
        )}
      </div>

      {/* Subtasks */}
      <Separator />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Subtasks ({subtasks.length})</h3>
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
        </div>
        {subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subtasks</p>
        ) : (
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <Card
                key={subtask.id}
                className="cursor-pointer p-3 transition-colors hover:bg-accent"
                onClick={() => onSubtaskClick(subtask.id)}
              >
                <div className="flex items-center gap-2">
                  {subtask.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2" />
                  )}
                  <span className={subtask.completed ? 'line-through text-muted-foreground' : ''}>
                    {subtask.description}
                  </span>
                </div>
              </Card>
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
      <div className="text-xs text-muted-foreground">
        <p>Created {format(new Date(task.createdAt), 'PPP')}</p>
        <p>Updated {format(new Date(task.updatedAt), 'PPP')}</p>
      </div>
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
