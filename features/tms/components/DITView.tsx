'use client';

import { Sun, CalendarDays, Inbox, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskCard } from './shared/TaskCard';
import { TaskListView } from './shared/TaskListView';
import { SectionHeader } from './shared/SectionHeader';
import { TMSEmptyState } from './shared/TMSEmptyState';
import type { TMSViewProps } from '../handlers';
import type { DITState, DITAction } from '../handlers/DITHandler';

/**
 * DIT (Do It Tomorrow) View
 *
 * Pure presentational component — no store access.
 * Accepts TMSViewProps<DITState> and dispatches DITAction.
 *
 * Three zones stacked vertically:
 *   Today    — border-l-2 border-l-primary
 *   Tomorrow — border-l-2 border-l-slate-600
 *   Inbox    — border-l-amber-500 when non-empty, border-l-border when empty
 *
 * Ref: UI-UX-DESIGN.md §7
 */

export function DITView({
  tasks,
  systemState,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<DITState>) {
  const todayTasks    = tasks.filter(t => systemState.todayTasks.includes(t.id));
  const tomorrowTasks = tasks.filter(t => systemState.tomorrowTasks.includes(t.id));
  const inboxTasks    = tasks.filter(
    t => !systemState.todayTasks.includes(t.id) && !systemState.tomorrowTasks.includes(t.id),
  );

  const hasInbox = inboxTasks.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Today Zone ──────────────────────────────────────────────────── */}
      <section
        aria-label="Today"
        className="rounded-[14px] border-l-2 border-l-primary border-t border-r border-b border-border p-4"
      >
        <SectionHeader title="Today" count={todayTasks.length} countVariant="default" icon={<Clock className="h-4 w-4 text-teal-400" />} titleClassName="text-teal-400" />

        <TaskListView
          tasks={todayTasks}
          emptyState={
            <TMSEmptyState
              icon={<Sun className="h-5 w-5" />}
              title="Nothing scheduled for today"
              description="Move tasks from Tomorrow or Inbox."
            />
          }
          renderTask={(task) => (
            <TaskCard
              task={task}
              onClick={() => onTaskClick(task.id)}
              onComplete={(completed) => onTaskComplete(task.id, completed)}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    (dispatch as (a: DITAction) => void)({ type: 'MOVE_TO_TOMORROW', taskId: task.id });
                  }}
                >
                  → Tomorrow
                </Button>
              }
            />
          )}
        />
      </section>

      {/* ── Tomorrow Zone ───────────────────────────────────────────────── */}
      <section
        aria-label="Tomorrow"
        className="rounded-[14px] border-l-2 border-l-slate-600 border-t border-r border-b border-border p-4"
      >
        <SectionHeader title="Tomorrow" count={tomorrowTasks.length} countVariant="slate" icon={<CalendarDays className="h-4 w-4 text-slate-500" />} />

        <TaskListView
          tasks={tomorrowTasks}
          emptyState={
            <TMSEmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="Nothing for tomorrow yet"
              description="New tasks you create will appear here."
            />
          }
          renderTask={(task) => (
            <TaskCard
              task={task}
              onClick={() => onTaskClick(task.id)}
              onComplete={(completed) => onTaskComplete(task.id, completed)}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    (dispatch as (a: DITAction) => void)({ type: 'MOVE_TO_TODAY', taskId: task.id });
                  }}
                >
                  ← Today
                </Button>
              }
            />
          )}
        />
      </section>

      {/* ── Inbox Zone ──────────────────────────────────────────────────── */}
      <section
        aria-label="Inbox"
        className={`rounded-[14px] border-l-2 p-4 ${
          hasInbox
            ? 'border-l-amber-500 border-t border-r border-b border-amber-500/30'
            : 'border-l-border border-t border-r border-b border-border'
        }`}
      >
        <SectionHeader
          title="Inbox"
          count={inboxTasks.length}
          countVariant={hasInbox ? 'amber' : 'secondary'}
          icon={<Inbox className="h-4 w-4 text-slate-500" />}
          titleClassName="text-slate-500"
        />

        <TaskListView
          tasks={inboxTasks}
          emptyState={
            <TMSEmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="All tasks are scheduled"
            />
          }
          renderTask={(task) => (
            <TaskCard
              task={task}
              onClick={() => onTaskClick(task.id)}
              onComplete={(completed) => onTaskComplete(task.id, completed)}
              actions={
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      (dispatch as (a: DITAction) => void)({ type: 'MOVE_TO_TODAY', taskId: task.id });
                    }}
                  >
                    → Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      (dispatch as (a: DITAction) => void)({ type: 'MOVE_TO_TOMORROW', taskId: task.id });
                    }}
                  >
                    → Tomorrow
                  </Button>
                </div>
              }
            />
          )}
        />
      </section>
    </div>
  );
}
