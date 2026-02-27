'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { Task } from '@/types';

interface AF4FlaggedNoticeProps {
  dismissedTaskIds: string[];
  tasks: Task[];
  onResolve: (taskId: string, resolution: 'abandon' | 're-enter' | 'defer') => void;
}

/**
 * AF4FlaggedNotice — inline banner shown when AF4 has dismissed tasks needing resolution.
 *
 * Shows count of flagged tasks and a "Resolve" toggle that expands a per-task
 * resolution panel with Abandon / Re-enter / Defer actions.
 * Disappears when dismissedTaskIds is empty.
 *
 * Feature: tms-inline-interactions, Properties 22, 23, and 24
 */
export function AF4FlaggedNotice({ dismissedTaskIds, tasks, onResolve }: AF4FlaggedNoticeProps) {
  const [expanded, setExpanded] = useState(false);

  if (dismissedTaskIds.length === 0) return null;

  const flaggedTasks = dismissedTaskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);

  return (
    <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {dismissedTaskIds.length} flagged task{dismissedTaskIds.length !== 1 ? 's' : ''} need resolution
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-amber-400 hover:text-amber-300 h-6 px-2"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="Resolve flagged tasks"
        >
          {expanded ? 'Hide' : 'Resolve'}
        </Button>
      </div>

      {expanded && flaggedTasks.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-amber-500/20 pt-2">
          {flaggedTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground truncate flex-1">{task.description}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onResolve(task.id, 'abandon')}
                  aria-label={`Abandon: ${task.description}`}
                >
                  Abandon
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2 text-accent-brand hover:text-accent-brand hover:bg-accent-brand/10"
                  onClick={() => onResolve(task.id, 're-enter')}
                  aria-label={`Re-enter: ${task.description}`}
                >
                  Re-enter
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => onResolve(task.id, 'defer')}
                  aria-label={`Defer: ${task.description}`}
                >
                  Defer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
