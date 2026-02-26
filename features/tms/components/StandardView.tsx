'use client';

/**
 * StandardView — Review Queue view for the Standard TMS system.
 *
 * Reuses TaskList for the enriched table (inline editing, columns, keyboard nav).
 * Tasks sorted by lastActionAt ascending (oldest first).
 * First task gets "Needs Attention" treatment via tmsTaskProps.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/features/tasks/components/TaskList';
import { TMSEmptyState } from './shared/TMSEmptyState';
import type { TMSViewProps } from '../handlers';
import type { Section, Task } from '@/types';

type StandardState = Record<string, never>;
type StandardAction = { type: 'REINSERT_TASK'; taskId: string };

const VIRTUAL_SECTION: Section = {
  id: '__std_all__',
  projectId: null,
  name: 'All Tasks',
  order: 0,
  collapsed: false,
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
};

export function StandardView({
  tasks,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<StandardState>) {
  const [showCompleted, setShowCompleted] = useState(true);

  const sortedTasks = useMemo(() => {
    const filtered = showCompleted ? tasks : tasks.filter(t => !t.completed);
    return [...filtered]
      .sort((a, b) => {
        const aTime = a.lastActionAt ? new Date(a.lastActionAt).getTime() : 0;
        const bTime = b.lastActionAt ? new Date(b.lastActionAt).getTime() : 0;
        return aTime - bTime;
      })
      .map((t, i) => ({ ...t, sectionId: VIRTUAL_SECTION.id, order: i }));
  }, [tasks, showCompleted]);

  const firstTaskId = sortedTasks.find(t => !t.completed)?.id ?? null;

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
    <div className="flex flex-col h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">All Tasks</h1>
          {completedTodayCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedTodayCount} completed today
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-brand/15 text-accent-brand border border-accent-brand/25">
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

      {/* Reuse TaskList */}
      <TaskList
        tasks={sortedTasks}
        sections={[VIRTUAL_SECTION]}
        onTaskClick={onTaskClick}
        onTaskComplete={(taskId, completed) => onTaskComplete(taskId, completed)}
        onAddTask={() => {}}
        showReinsertButton
        onReinsert={(taskId) => {
          (dispatch as (a: StandardAction) => void)({ type: 'REINSERT_TASK', taskId });
        }}
        tmsTaskProps={(task) => ({
          tmsVariant: task.id === firstTaskId ? 'attention' as const : undefined,
          leadingSlot: task.id === firstTaskId ? (
            <span className="text-[10px] font-bold tracking-[0.08em] text-accent-brand uppercase shrink-0 hidden sm:inline">
              Needs Attention
            </span>
          ) : undefined,
        })}
      />
    </div>
  );
}
