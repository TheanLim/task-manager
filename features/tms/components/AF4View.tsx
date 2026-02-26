'use client';

import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, SkipForward, AlertTriangle, Calendar } from 'lucide-react';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { format } from 'date-fns';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import {
  getCurrentTask,
  isFullPassComplete,
  didWork,
  skipTask,
  advanceAfterFullPass,
  dismissTask,
} from '@/features/tms/handlers/AF4Handler';

interface AF4ViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function AF4View({ tasks, onTaskClick, onTaskComplete }: AF4ViewProps) {
  const { state, updateState } = useTMSStore();
  const { updateTask } = useDataStore();

  const af4 = state.af4;
  const current = getCurrentTask(tasks, state);
  const passComplete = isFullPassComplete(state);

  // Resolve task objects for display
  const backlogTasks = af4.backlogTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const activeTasks = af4.activeListTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const dismissedSet = new Set(af4.dismissedTaskIds);

  const handleDidWork = () => {
    if (!current) return;
    onTaskComplete(current.id, true);
    updateState(didWork(tasks, state));
  };

  const handleSkip = () => {
    if (passComplete) {
      updateState(advanceAfterFullPass(tasks, state));
    } else {
      updateState(skipTask(state));
    }
  };

  const handleDismiss = () => {
    if (!current) return;
    updateState(dismissTask(current.id, state));
    updateState(skipTask(state));
  };

  const renderTask = (task: Task, isCurrent: boolean) => (
    <Card
      key={task.id}
      className={`p-3 transition-colors hover:bg-accent ${isCurrent ? 'border-primary bg-primary/5' : ''} ${dismissedSet.has(task.id) ? 'border-yellow-500/50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => onTaskComplete(task.id, checked === true)}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {dismissedSet.has(task.id) && (
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onTaskClick(task.id)}>
              <InlineEditable
                value={task.description}
                onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
                validate={validateTaskDescription}
                placeholder="Task description"
                displayClassName={task.completed ? 'line-through text-muted-foreground' : ''}
                inputClassName="w-full"
              />
            </div>
            {task.priority !== 'none' && (
              <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                {task.priority}
              </Badge>
            )}
          </div>

          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), 'MMM d')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons for the current task */}
      {isCurrent && (
        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Button size="sm" className="flex-1" onClick={handleDidWork}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Did work
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleSkip}>
            <SkipForward className="mr-2 h-4 w-4" />
            {passComplete ? 'End pass' : 'Skip'}
          </Button>
          {!dismissedSet.has(task.id) && (
            <Button size="sm" variant="ghost" onClick={handleDismiss} title="Flag as stubborn">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <Badge variant={af4.phase === 'backlog' ? 'default' : 'secondary'}>
          {af4.phase === 'backlog' ? 'Working Backlog' : 'Active List Pass'}
        </Badge>
        {passComplete && (
          <Badge variant="outline" className="text-yellow-600 border-yellow-500">
            Pass complete — no work done
          </Badge>
        )}
      </div>

      {/* Backlog section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Backlog</h3>
          <Badge variant="secondary">{backlogTasks.length} tasks</Badge>
        </div>

        {backlogTasks.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground text-sm">
            Backlog is empty — Active List will become the new Backlog.
          </Card>
        ) : (
          <div className="space-y-2">
            {backlogTasks.map((task, idx) =>
              renderTask(task, af4.phase === 'backlog' && idx === af4.currentPosition)
            )}
          </div>
        )}
      </div>

      {/* Visual divider — the "line" */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-dashed border-muted-foreground/40" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">— line —</span>
        </div>
      </div>

      {/* Active List section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Active List</h3>
          <Badge variant="secondary">{activeTasks.length} tasks</Badge>
        </div>

        {activeTasks.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground text-sm">
            New tasks you create will appear here.
          </Card>
        ) : (
          <div className="space-y-2">
            {activeTasks.map((task, idx) =>
              renderTask(task, af4.phase === 'active' && idx === af4.currentPosition)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
