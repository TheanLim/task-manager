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

interface FVPViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function FVPView({ tasks, onTaskClick, onTaskComplete }: FVPViewProps) {
  const { state, startFVPSelection, selectFVPTask, skipFVPTask, endFVPSelection, resetFVP } = useTMSStore();
  const { updateTask } = useDataStore();

  // Get dotted tasks in reverse order (working order)
  const dottedTasks = [...state.fvp.dottedTasks]
    .reverse()
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  // Get undotted tasks
  const undottedTasks = tasks.filter(
    t => !state.fvp.dottedTasks.includes(t.id) && !t.completed
  );

  const currentX = state.fvp.currentX ? tasks.find(t => t.id === state.fvp.currentX) : null;
  
  // Get the next task to compare (first undotted task that's not X)
  const currentComparison = state.fvp.selectionInProgress && currentX
    ? undottedTasks.find(t => t.id !== currentX.id)
    : null;

  const renderTask = (task: Task, isDotted: boolean) => (
    <Card
      key={task.id}
      className="p-3 cursor-pointer transition-colors hover:bg-accent"
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => {
            onTaskComplete(task.id, checked === true);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isDotted && <Dot className="h-5 w-5 text-primary" />}
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
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Selection Interface */}
      {state.fvp.selectionInProgress && currentX && currentComparison ? (
        <Card className="p-6 bg-primary/5 border-primary">
          <h3 className="text-lg font-semibold mb-4">FVP Selection</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current X:</p>
              <Card className="p-3 bg-background">
                <p className="font-medium">{currentX.description}</p>
              </Card>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Would you do this task before X?
              </p>
              <Card className="p-3 bg-background">
                <p className="font-medium">{currentComparison.description}</p>
              </Card>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => selectFVPTask(currentComparison.id)}
              >
                <Circle className="mr-2 h-4 w-4" />
                Yes, do this before X
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => skipFVPTask()}
              >
                Skip
              </Button>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={endFVPSelection}
            >
              End Selection
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const firstTask = undottedTasks[0];
              if (firstTask) {
                startFVPSelection(firstTask.id);
              }
            }}
            disabled={undottedTasks.length === 0}
            className="flex-1"
          >
            <Circle className="mr-2 h-4 w-4" />
            Start Selection
          </Button>
          {dottedTasks.length > 0 && (
            <Button
              variant="outline"
              onClick={resetFVP}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      )}

      {/* Dotted Tasks (Working Order) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Dotted Tasks (Work in this order)</h3>
          <Badge variant="default">{dottedTasks.length} tasks</Badge>
        </div>
        
        {dottedTasks.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              No tasks dotted yet. Start the selection process to prioritize tasks.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {dottedTasks.map(task => renderTask(task, true))}
          </div>
        )}
      </div>

      {/* Undotted Tasks */}
      {undottedTasks.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Undotted Tasks</h3>
            <Badge variant="secondary">{undottedTasks.length} tasks</Badge>
          </div>
          
          <div className="space-y-2">
            {undottedTasks.map(task => renderTask(task, false))}
          </div>
        </div>
      )}
    </div>
  );
}
