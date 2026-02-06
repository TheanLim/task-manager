'use client';

import { Task, UUID } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, AlertCircle } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';

interface DependencyListProps {
  blockingTasks: Task[];
  blockedTasks: Task[];
  currentTaskId: UUID;
  onRemoveDependency: (blockingTaskId: UUID, blockedTaskId: UUID) => void;
}

export function DependencyList({
  blockingTasks,
  blockedTasks,
  currentTaskId,
  onRemoveDependency,
}: DependencyListProps) {
  const hasBlockingTasks = blockingTasks.length > 0;
  const hasBlockedTasks = blockedTasks.length > 0;
  const isBlocked = blockingTasks.some(t => !t.completed);

  return (
    <div className="space-y-4">
      {isBlocked && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            This task is blocked by incomplete tasks
          </span>
        </div>
      )}

      {hasBlockingTasks && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Blocked By</h4>
          <div className="space-y-2">
            {blockingTasks.map((task) => (
              <Card key={task.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{task.description}</span>
                      {task.completed ? (
                        <Badge variant="secondary" className="text-xs">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Incomplete
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveDependency(task.id, currentTaskId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {hasBlockedTasks && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Blocks</h4>
          <div className="space-y-2">
            {blockedTasks.map((task) => (
              <Card key={task.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{task.description}</span>
                      {task.completed ? (
                        <Badge variant="secondary" className="text-xs">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          Incomplete
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveDependency(currentTaskId, task.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!hasBlockingTasks && !hasBlockedTasks && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No dependencies
        </div>
      )}
    </div>
  );
}
