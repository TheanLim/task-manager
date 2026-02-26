'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionHeader } from './shared/SectionHeader';
import { TMSEmptyState } from './shared/TMSEmptyState';
import { TaskCard } from './shared/TaskCard';
import { PriorityBadge } from './shared/PriorityBadge';
import { DueDateLabel } from './shared/DueDateLabel';
import type { TMSViewProps } from '../handlers';
import type { AF4State, AF4Action } from '../handlers/af4';
import {
  getCurrentTask,
  isFullPassComplete,
} from '../handlers/af4';

/**
 * AF4 (Autofocus 4) View
 *
 * Pure presentational component — no store access.
 * Accepts TMSViewProps<AF4State> and dispatches AF4Action.
 *
 * Key design rules (UI-UX-DESIGN.md §6):
 * - Phase indicator: ONE badge at a time (Working Backlog OR Active List Pass OR pass-complete amber)
 * - "↺ Made progress": teal outline, flex-1 — does NOT call onTaskComplete
 * - "✓ Done": ghost, size="sm" — calls onTaskComplete AND dispatches MARK_DONE
 * - Line divider: border-t-2 (solid, not dashed) with date-fns timestamp
 * - Dismissed tasks: amber left border, ⚠ icon toggles inline resolution panel
 * - Pass-complete: auto-advance after 1500ms via useEffect
 */

export function AF4View({
  tasks,
  systemState,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<AF4State>) {
  const af4Dispatch = dispatch as (action: AF4Action) => void;
  const [expandedDismissedId, setExpandedDismissedId] = useState<string | null>(null);

  const current = getCurrentTask(tasks, systemState);
  const fullPassDone = isFullPassComplete(systemState);
  const passCompleteNoWork = fullPassDone && !systemState.lastPassHadWork;
  const passCompleteWithWork = fullPassDone && systemState.lastPassHadWork;

  // Auto-advance after 1500ms when a full pass is complete
  useEffect(() => {
    if (!fullPassDone) return;
    const timer = setTimeout(() => {
      af4Dispatch({ type: 'ADVANCE_AFTER_FULL_PASS', tasks });
    }, 1500);
    return () => clearTimeout(timer);
  }, [fullPassDone, tasks, af4Dispatch]);

  const backlogTasks = systemState.backlogTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const activeTasks = systemState.activeListTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const dismissedSet = new Set(systemState.dismissedTaskIds);

  const lineDrawnAtRef = useRef(new Date());
  const lineTimestamp = format(lineDrawnAtRef.current, 'MMM d, h:mmaaa');

  const handleMadeProgress = () => {
    af4Dispatch({ type: 'MADE_PROGRESS' });
    // Intentionally does NOT call onTaskComplete — task stays incomplete
  };

  const handleDone = () => {
    if (!current) return;
    onTaskComplete(current.id, true);
    af4Dispatch({ type: 'MARK_DONE' });
  };

  const handleSkip = () => {
    af4Dispatch({ type: 'SKIP_TASK' });
  };

  const handleDismiss = () => {
    af4Dispatch({ type: 'FLAG_DISMISSED' });
  };

  const handleToggleDismissedPanel = (taskId: string) => {
    setExpandedDismissedId(prev => (prev === taskId ? null : taskId));
  };

  const handleResolve = (taskId: string, resolution: 'abandon' | 're-enter' | 'defer') => {
    af4Dispatch({ type: 'RESOLVE_DISMISSED', taskId, resolution });
    setExpandedDismissedId(null);
  };

  const handlePromote = () => {
    af4Dispatch({ type: 'PROMOTE_ACTIVE_LIST' });
  };

  const renderTask = (task: typeof tasks[number], isCurrent: boolean) => {
    const isDismissed = dismissedSet.has(task.id);
    const isExpanded = expandedDismissedId === task.id;

    if (isDismissed) {
      return (
        <div
          key={task.id}
          className="border-l-2 border-l-amber-500 border-t border-r border-b border-border rounded-lg p-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 cursor-pointer"
              onClick={() => handleToggleDismissedPanel(task.id)}
              aria-label="Resolve flagged task"
              aria-expanded={isExpanded}
            />
            <span className="text-sm text-foreground flex-1 min-w-0">{task.description}</span>
          </div>
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border bg-amber-500/5 rounded-b-lg -mx-3 -mb-3 px-3 pb-3">
              <p className="text-xs text-amber-500 mb-3">
                This task keeps getting skipped. What do you want to do?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => handleResolve(task.id, 'abandon')}
                >
                  Abandon
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => handleResolve(task.id, 're-enter')}
                >
                  Re-enter on Active List
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResolve(task.id, 'defer')}
                >
                  Defer back to Backlog
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (isCurrent) {
      return (
        <TaskCard
          key={task.id}
          task={task}
          variant="current"
          onClick={() => onTaskClick(task.id)}
          onComplete={(completed) => onTaskComplete(task.id, completed)}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 flex-1 text-sm"
                onClick={(e) => { e.stopPropagation(); handleMadeProgress(); }}
              >
                ↺ Made progress
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); handleDone(); }}
              >
                ✓ Done
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); handleSkip(); }}
              >
                → Skip
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Flag as stubborn"
                className="text-amber-500 hover:text-amber-400"
                onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              >
                ⚠
              </Button>
            </div>
          }
        />
      );
    }

    return (
      <TaskCard
        key={task.id}
        task={task}
        variant="default"
        onClick={() => onTaskClick(task.id)}
        onComplete={(completed) => onTaskComplete(task.id, completed)}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Phase indicator bar — ONE badge at a time ─────────────────────── */}
      <div className="flex items-center gap-2 mb-4" aria-live="polite">
        {passCompleteNoWork ? (
          <Badge
            className="bg-amber-500/20 text-amber-500 border border-amber-500/30"
            aria-live="assertive"
          >
            Backlog pass complete — switching to Active List
          </Badge>
        ) : passCompleteWithWork ? (
          <Badge
            className="bg-amber-500/20 text-amber-500 border border-amber-500/30"
            aria-live="assertive"
          >
            Backlog pass complete — restarting from top
          </Badge>
        ) : systemState.phase === 'backlog' ? (
          <Badge key="backlog" className="bg-primary/20 text-primary border border-primary/30">
            Working Backlog
          </Badge>
        ) : (
          <Badge key="active" className="bg-slate-700 text-slate-300 border border-slate-600">
            Active List Pass
          </Badge>
        )}
      </div>

      {/* ── Backlog section ───────────────────────────────────────────────── */}
      <section aria-label="Backlog">
        <SectionHeader
          title="Backlog"
          count={backlogTasks.length}
          countVariant="secondary"
        />

        {backlogTasks.length === 0 ? (
          <TMSEmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Backlog complete!"
            description="Ready to draw a new line."
            action={{ label: 'Draw new line →', onClick: handlePromote }}
          />
        ) : (
          <div className="space-y-2">
            {backlogTasks.map((task, idx) =>
              renderTask(task, systemState.phase === 'backlog' && idx === systemState.currentPosition)
            )}
          </div>
        )}
      </section>

      {/* ── Line divider — solid border-t-2, NOT dashed ──────────────────── */}
      <div
        className="relative my-6"
        role="separator"
        aria-label={`Line drawn ${lineTimestamp}`}
      >
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t-2 border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground font-medium">
            — Line drawn {lineTimestamp} —
          </span>
        </div>
      </div>

      {/* ── Active List section ───────────────────────────────────────────── */}
      <section aria-label="Active List">
        <SectionHeader
          title="Active List"
          count={activeTasks.length}
          countVariant="secondary"
          hint="(new tasks appear here)"
        />

        {activeTasks.length === 0 ? (
          <TMSEmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Active List is empty"
            description="New tasks will appear here."
          />
        ) : (
          <div className="space-y-2">
            {activeTasks.map((task, idx) =>
              renderTask(task, systemState.phase === 'active' && idx === systemState.currentPosition)
            )}
          </div>
        )}
      </section>
    </div>
  );
}
