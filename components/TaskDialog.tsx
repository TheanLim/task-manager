'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Task, Priority } from '@/types';
import { validateTaskDescription } from '@/lib/validation';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    description: string;
    notes: string;
    assignee: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
  }) => void;
  task?: Task | null;
  parentTask?: Task | null;
}

/**
 * Dialog for creating or editing tasks
 */
export function TaskDialog({ open, onOpenChange, onSubmit, task, parentTask }: TaskDialogProps) {
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.NONE);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        // Editing existing task
        setDescription(task.description);
        setNotes(task.notes);
        setAssignee(task.assignee);
        setPriority(task.priority);
        setTags(task.tags);
        setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      } else {
        // Creating new task (top-level or subtask) - start with defaults
        setDescription('');
        setNotes('');
        setAssignee('');
        setPriority(Priority.NONE);
        setTags([]);
        setDueDate(undefined);
      }
      setTagInput('');
      setShowCalendar(false);
      setError(null);
    }
  }, [open, task, parentTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate task description
    try {
      validateTaskDescription(description);
      setError(null);
      onSubmit({
        description,
        notes,
        assignee,
        priority,
        tags,
        dueDate: dueDate ? dueDate.toISOString() : null
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogDescription>
              {task ? 'Update your task details.' : 'Create a new task for your project.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description"
                maxLength={500}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Additional notes (optional)"
              />
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value={Priority.NONE}>None</option>
                <option value={Priority.LOW}>Low</option>
                <option value={Priority.MEDIUM}>Medium</option>
                <option value={Priority.HIGH}>High</option>
              </select>
            </div>

            {/* Assignee */}
            <div className="grid gap-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Input
                id="assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Assignee name (optional)"
              />
            </div>

            {/* Due Date */}
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => setShowCalendar(!showCalendar)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                </Button>
                {dueDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDueDate(undefined)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {showCalendar && (
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date);
                    setShowCalendar(false);
                  }}
                  className="rounded-md border"
                />
              )}
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Add tag and press Enter"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{task ? 'Save Changes' : 'Create Task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
