'use client';

import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Circle, Dot, RotateCcw, Calendar } from 'lucide-react';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { format } from 'date-fns';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import {
  getCurrentTask,
  getCurrentX,
  getScanCandidate,
  isPreselectionComplete,
  dotTask,
  skipTask,
  completeCurrentTask,
  resetFVP,
} from '@/features/tms/handlers/FVPHandler';

interface FVPViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function FVPView({ tasks, onTaskClick, onTaskComplete }: FVPViewProps) {
  const { state, updateState } = useTMSStore();
  const { updateTask } = useDataStore();

  const incompleteTasks = tasks.filter(t => !t.completed);
  const dottedSet = new Set(state.fvp.dottedTasks);

  // Derived state via pure handler helpers
  const currentTask = getCurrentTask(tasks, state);
  const currentX = getCurrentX(tasks, state);
  const scanCandidate = getScanCandidate(tasks, state);
  const preselectionDone = isPreselectionComplete(tasks, state);

  // Display: dotted tasks in order (last = do now), then undotted
  const dottedTasks = state.fvp.dottedTasks
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const undottedTasks = incompleteTasks.filter(t => !dottedSet.has(t.id));

  const handleDot = () => {
    if (!scanCandidate) return;
    updateState(dotTask(scanCandidate, tasks, state));
  };

  const handleSkip = () => {
    if (!scanCandidate) return;
    updateState(skipTask(scanCandidate, tasks, state));
  };

  const handleCompleteCurrentTask = () => {
    if (!currentTask) return;
    onTaskComplete(currentTask.id, true);
    updateState(completeCurrentTask(tasks, state));
  };

  const handleReset = () => {
    updateState(resetFVP(state));
  };

  const renderTask = (task: Task, isDotted: boolean, isCurrentTask: boolean) => (
    <Card
      key={task.id}
      className={`p-3 cursor-pointer transition-colors hover:bg-accent ${isCurrentTask ? 'border-primary bg-primary/5' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => onTaskComplete(task.id, checked === true)}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isDotted && <Dot className="h-5 w-5 text-primary shrink-0" />}
            <div className="flex-1 min-w-0" onClick={() => onTaskClick(task.id)}>
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

        {isCurrentTask && (
          <Button size="sm" onClick={handleCompleteCurrentTask}>
            Done
          </Button>
        )}
      </div>
    </Card>
  );

  // ── Preselection UI ──────────────────────────────────────────────────────────
  const showPreselection = !preselectionDone && scanCandidate !== null;

  return (
    <div className="space-y-6">
      {/* Preselection comparison panel */}
      {showPreselection && currentX && scanCandidate ? (
        <Card className="p-6 bg-primary/5 border-primary">
          <h3 className="text-lg font-semibold mb-4">FVP Preselection</h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current X (reference):</p>
              <Card className="p-3 bg-background">
                <p className="font-medium">{currentX.description}</p>
              </Card>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Do you want to do this more than X?
              </p>
              <Card className="p-3 bg-background">
                <p className="font-medium">{scanCandidate.description}</p>
              </Card>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleDot}>
                <Circle className="mr-2 h-4 w-4" />
                Yes — dot it
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleSkip}>
                No — skip
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              // Resume preselection — scanPosition is already set correctly
              // Just trigger a re-render; the panel appears when candidate exists
              if (undottedTasks.length === 0 && dottedTasks.length === 0) return;
              // If preselection is complete, reset to start fresh
              if (preselectionDone && dottedTasks.length === 0) {
                updateState(resetFVP(state));
              }
            }}
            disabled={incompleteTasks.length === 0}
            className="flex-1"
          >
            <Circle className="mr-2 h-4 w-4" />
            {preselectionDone ? 'Preselection complete' : 'Resume Preselection'}
          </Button>
          {dottedTasks.length > 0 && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      )}

      {/* Current task to do (last dotted) */}
      {currentTask && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Do Now</h3>
            <Badge variant="default">current</Badge>
          </div>
          {renderTask(currentTask, true, true)}
        </div>
      )}

      {/* Dotted tasks queue (all except the last one shown above) */}
      {dottedTasks.length > 1 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Dotted Queue</h3>
            <Badge variant="secondary">{dottedTasks.length - 1} waiting</Badge>
          </div>
          <div className="space-y-2">
            {dottedTasks.slice(0, -1).map(task => renderTask(task, true, false))}
          </div>
        </div>
      )}

      {/* Undotted tasks */}
      {undottedTasks.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Undotted Tasks</h3>
            <Badge variant="secondary">{undottedTasks.length} tasks</Badge>
          </div>
          <div className="space-y-2">
            {undottedTasks.map(task => renderTask(task, false, false))}
          </div>
        </div>
      )}

      {incompleteTasks.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No tasks to work on.</p>
        </Card>
      )}
    </div>
  );
}
