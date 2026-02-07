'use client';

import { Task, TaskDependency, UUID } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DependencyList } from '@/components/DependencyList';
import {
  Calendar,
  Tag,
  User,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  ChevronsRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { format } from 'date-fns';

interface TaskDetailPanelProps {
  task: Task;
  subtasks: Task[];
  blockingTasks: Task[];
  blockedTasks: Task[];
  onEdit: () => void;
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
 * Panel to display full task details
 */
export function TaskDetailPanel({
  task,
  subtasks,
  blockingTasks,
  blockedTasks,
  onEdit,
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
  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-2">
        {/* Completion Button - Left */}
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

        {/* Action Buttons - Right */}
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onExpand} title={isExpanded ? "Collapse" : "Expand to full page"}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onClose} title="Close panel">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{task.description}</h2>
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
        {task.priority !== 'none' && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Priority:</span>
            <Badge>{task.priority}</Badge>
          </div>
        )}

        {/* Due Date */}
        {task.dueDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Due {format(new Date(task.dueDate), 'PPP')}</span>
          </div>
        )}

        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>@{task.assignee}</span>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {task.notes && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
          </div>
        </>
      )}

      {/* Subtasks */}
      <Separator />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Subtasks ({subtasks.length})</h3>
          <Button variant="outline" size="sm" onClick={onAddSubtask}>
            <Plus className="mr-2 h-4 w-4" />
            Add Subtask
          </Button>
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
          <Button variant="outline" size="sm" onClick={onAddDependency}>
            <Plus className="mr-2 h-4 w-4" />
            Add Dependency
          </Button>
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
  );
}
