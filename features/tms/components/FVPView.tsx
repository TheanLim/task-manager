'use client';

import { Button } from '@/components/ui/button';
import { ListTodo, PartyPopper } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskCard } from './shared/TaskCard';
import { TMSEmptyState } from './shared/TMSEmptyState';
import type { TMSViewProps } from '../handlers';
import type { FVPState, FVPAction } from '../handlers/fvp';
import {
  getCurrentTask,
  getCurrentX,
  getScanCandidate,
  getOrderedTasks,
  isPreselectionComplete,
} from '../handlers/fvp';

/**
 * FVP (Final Version Perfected) View
 *
 * Pure presentational component — no store access.
 * Accepts TMSViewProps<FVPState> and dispatches FVPAction.
 *
 * Three states:
 *   A — No dotted tasks: "Start Preselection" full-width teal button
 *   B — Preselection in progress: preselection panel ONLY (no Do Now) + unified task list
 *   C — Preselection complete: Do Now + optional "Resume Preselection" outline button
 *
 * Ref: UI-UX-DESIGN.md §5
 */

export function FVPView({
  tasks,
  systemState,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<FVPState>) {
  const fvpDispatch = dispatch as (action: FVPAction) => void;

  const incompleteTasks = tasks.filter(t => !t.completed);
  const dottedSet = new Set(systemState.dottedTasks);

  // Derived state via pure handler helpers
  const currentTask = getCurrentTask(tasks, systemState);
  const currentX = getCurrentX(tasks, systemState);
  const scanCandidate = getScanCandidate(tasks, systemState);
  const preselectionDone = isPreselectionComplete(tasks, systemState);
  const orderedTasks = getOrderedTasks(tasks, systemState);

  const undottedTasks = incompleteTasks.filter(t => !dottedSet.has(t.id));

  // State A: no dotted tasks at all
  const isStateA = systemState.dottedTasks.length === 0;
  // State B: preselection in progress (has candidate)
  const isStateB = !preselectionDone && scanCandidate !== null;
  // State C: preselection complete (no more candidates, but has dotted tasks)
  const isStateC = preselectionDone && systemState.dottedTasks.length > 0;

  const handleStartPreselection = () => {
    fvpDispatch({ type: 'START_PRESELECTION' });
  };

  const handleDot = () => {
    if (!scanCandidate) return;
    fvpDispatch({ type: 'DOT_TASK', task: scanCandidate, tasks });
  };

  const handleSkip = () => {
    if (!scanCandidate) return;
    fvpDispatch({ type: 'SKIP_CANDIDATE', task: scanCandidate, tasks });
  };

  const handleCompleteCurrent = () => {
    if (!currentTask) return;
    onTaskComplete(currentTask.id, true);
    fvpDispatch({ type: 'COMPLETE_CURRENT', tasks });
  };

  const handleReenterCurrent = () => {
    if (!currentTask) return;
    // Don't mark complete — just remove from dotted chain. Task stays in the list.
    fvpDispatch({ type: 'REENTER_CURRENT', tasks });
  };

  const handleReset = () => {
    fvpDispatch({ type: 'RESET_FVP' });
  };

  // ── Empty state (no tasks at all) ─────────────────────────────────────────
  if (incompleteTasks.length === 0) {
    return (
      <TMSEmptyState
        icon={<ListTodo className="h-6 w-6" />}
        title="No tasks yet"
        description="Add some tasks to get started with FVP."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── State A: Start Preselection ──────────────────────────────────── */}
      {isStateA && (
        <Button className="w-full" onClick={handleStartPreselection}>
          Start Preselection
        </Button>
      )}

      {/* ── Do Now section (State C only — preselection complete) ─────── */}
      {isStateC && currentTask && (
        <div className="mb-4">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-2">
            Do Now
          </p>
          <div className="bg-primary/5 border border-primary rounded-xl p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={false}
                onCheckedChange={() => handleCompleteCurrent()}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0"
              />
              <span
                className="flex-1 text-sm font-medium text-foreground cursor-pointer"
                onClick={() => onTaskClick(currentTask.id)}
              >
                {currentTask.description}
              </span>
            </div>
            <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={(e) => { e.stopPropagation(); handleCompleteCurrent(); }}
              >
                ✓ Done
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary hover:bg-primary/10"
                onClick={(e) => { e.stopPropagation(); handleReenterCurrent(); }}
              >
                ↺ Re-enter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── State B: Preselection panel ──────────────────────────────────── */}
      {isStateB && currentX && scanCandidate && (
        <div
          key={scanCandidate.id}
          className="bg-card border border-primary/30 rounded-xl p-4 mb-4"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-sm text-muted-foreground mb-3">
            Do you want to do{' '}
            <button
              className="text-foreground font-semibold underline decoration-primary/40 underline-offset-2 hover:text-primary transition-colors cursor-pointer"
              onClick={() => onTaskClick(scanCandidate.id)}
            >
              {scanCandidate.description}
            </button>
            {' '}more than{' '}
            <button
              className="text-foreground font-semibold underline decoration-primary/40 underline-offset-2 hover:text-primary transition-colors cursor-pointer"
              onClick={() => onTaskClick(currentX.id)}
            >
              {currentX.description}
            </button>
            ?
          </p>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
              onClick={handleDot}
            >
              ● Yes — dot it
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleSkip}>
              No — skip
            </Button>
          </div>
        </div>
      )}

      {/* ── State C: Resume Preselection button ──────────────────────────── */}
      {isStateC && undottedTasks.length > 0 && (
        <Button
          variant="outline"
          className="w-full mb-4"
          onClick={handleStartPreselection}
        >
          Resume Preselection
        </Button>
      )}

      {/* ── State C: All done empty state ────────────────────────────────── */}
      {isStateC && undottedTasks.length === 0 && !currentTask && (
        <TMSEmptyState
          icon={<PartyPopper className="h-6 w-6" />}
          title="All done!"
          description="Add more tasks or reset to start fresh."
          action={{ label: 'Reset FVP', onClick: handleReset }}
        />
      )}

      {/* ── Unified task list ─────────────────────────────────────────────── */}
      {orderedTasks.length > 0 && (
        <div className="space-y-2">
          {orderedTasks.map(task => {
            const isDotted = dottedSet.has(task.id);
            const isCurrentTask = currentTask?.id === task.id;
            return (
              <TaskCard
                key={task.id}
                task={task}
                variant={isCurrentTask ? 'current' : 'default'}
                dotted={isDotted}
                onClick={() => onTaskClick(task.id)}
                onComplete={(completed) => onTaskComplete(task.id, completed)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
