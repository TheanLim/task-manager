'use client';

/**
 * StandardView — Review Queue view for the Standard TMS system.
 *
 * Wraps GlobalTasksView with Review Queue semantics:
 * - Tasks sorted by lastActionAt ascending (oldest first)
 * - First task gets "Needs Attention" treatment with Reinsert button
 * - Local toggles for flat/nested view and hide-completed
 *
 * Ref: UI-UX-DESIGN.md §4, §12 "StandardView"
 * Requirements: 5.1, 5.5
 */

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskCard } from './shared/TaskCard';
import { TaskListView } from './shared/TaskListView';
import { TMSEmptyState } from './shared/TMSEmptyState';
import type { TMSViewProps } from '../handlers';

// StandardState is {} — no handler state needed
type StandardState = Record<string, never>;

type StandardAction = { type: 'REINSERT_TASK'; taskId: string };

export function StandardView({
  tasks,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<StandardState>) {
  const [showCompleted, setShowCompleted] = useState(true);

  // Sort by lastActionAt ascending (null/missing treated as oldest)
  const sortedTasks = useMemo(() => {
    const filtered = showCompleted ? tasks : tasks.filter(t => !t.completed);
    return [...filtered].sort((a, b) => {
      const aTime = a.lastActionAt ? new Date(a.lastActionAt).getTime() : 0;
      const bTime = b.lastActionAt ? new Date(b.lastActionAt).getTime() : 0;
      return aTime - bTime;
    });
  }, [tasks, showCompleted]);

  // Count tasks completed today
  const completedTodayCount = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.filter(
      t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === today,
    ).length;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <TMSEmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="All caught up!"
        description="Nothing needs attention right now."
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">All Tasks</h1>
          {completedTodayCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedTodayCount} completed today
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary border border-primary/30">
            Review Queue
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCompleted(prev => !prev)}
          >
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </Button>
        </div>
      </div>

      {/* Task list */}
      <TaskListView
        tasks={sortedTasks}
        emptyState={
          <TMSEmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="All caught up!"
            description="Nothing needs attention right now."
          />
        }
        renderTask={(task, index) => {
          const isFirst = index === 0;
          return (
            <TaskCard
              task={task}
              variant={isFirst ? 'attention' : 'default'}
              showProjectName={true}
              onClick={() => onTaskClick(task.id)}
              onComplete={(completed) => onTaskComplete(task.id, completed)}
              actions={
                isFirst ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold tracking-widest text-primary uppercase mt-1 block">
                      ↑ Needs Attention
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/10 self-start"
                      onClick={(e) => {
                        e.stopPropagation();
                        (dispatch as (a: StandardAction) => void)({
                          type: 'REINSERT_TASK',
                          taskId: task.id,
                        });
                      }}
                    >
                      ↺ Reinsert
                    </Button>
                  </div>
                ) : undefined
              }
            />
          );
        }}
      />
    </div>
  );
}
