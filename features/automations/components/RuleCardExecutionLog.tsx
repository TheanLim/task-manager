'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Activity } from 'lucide-react';
import type { ExecutionLogEntry } from '../types';

interface RuleCardExecutionLogProps {
  entries: ExecutionLogEntry[];
}

/**
 * Format an ISO timestamp into a human-readable relative time string.
 */
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'Just now';

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(isoTimestamp).toLocaleDateString();
}

export function RuleCardExecutionLog({ entries }: RuleCardExecutionLogProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t pt-2">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Activity className="h-3 w-3" />
        <span>Recent activity</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-5">No activity yet</p>
          ) : (
            entries.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className="text-xs pl-5 flex flex-col gap-0.5"
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-muted-foreground shrink-0">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                  <span className="truncate">
                    {entry.triggerDescription} → {entry.actionDescription}
                  </span>
                </div>
                <span className="text-muted-foreground truncate">
                  Task: {entry.taskName}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
