'use client';

import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, StarOff, Calendar } from 'lucide-react';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { format } from 'date-fns';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';

interface AF4ViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function AF4View({ tasks, onTaskClick, onTaskComplete }: AF4ViewProps) {
  const { state, markTask, unmarkTask } = useTMSStore();
  const { updateTask } = useDataStore();

  // Get marked tasks in order
  const markedTasks = state.af4.markedTasks
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  // Get unmarked tasks
  const unmarkedTasks = tasks.filter(
    t => !state.af4.markedTasks.includes(t.id)
  );

  const renderTask = (task: Task, isMarked: boolean) => (
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

        {!task.completed && (
          <Button
            size="sm"
            variant={isMarked ? 'default' : 'outline'}
            onClick={(e) => {
              e.stopPropagation();
              if (isMarked) {
                unmarkTask(task.id);
              } else {
                markTask(task.id);
              }
            }}
          >
            {isMarked ? (
              <>
                <StarOff className="h-4 w-4 mr-1" />
                Unmark
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-1" />
                Mark
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Marked Tasks Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Marked Tasks</h3>
          <Badge variant="default">{markedTasks.length} tasks</Badge>
        </div>
        
        {markedTasks.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              No tasks marked yet. Mark tasks you want to focus on.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {markedTasks.map(task => renderTask(task, true))}
          </div>
        )}
      </div>

      {/* Unmarked Tasks Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Unmarked Tasks</h3>
          <Badge variant="secondary">{unmarkedTasks.length} tasks</Badge>
        </div>
        
        {unmarkedTasks.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              All tasks are marked!
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {unmarkedTasks.map(task => renderTask(task, false))}
          </div>
        )}
      </div>
    </div>
  );
}
