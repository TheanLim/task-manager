'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Activity } from 'lucide-react';
import { formatRelativeTime } from '../../services/preview/formatters';
import type { ExecutionLogEntry } from '../../types';

const EXECUTION_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: '⚡ Scheduled',
    className: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
  },
  'catch-up': {
    label: '🔄 Catch-up',
    className: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  },
  manual: {
    label: '🔧 Manual',
    className: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  },
  skipped: {
    label: '⏭️ Skipped',
    className: 'bg-gray-100 dark:bg-gray-950/30 text-gray-700 dark:text-gray-400',
  },
};

const MAX_DETAILS_SHOWN = 10;

interface ScheduleHistoryViewProps {
  entries: ExecutionLogEntry[];
}

export function ScheduleHistoryView({ entries }: ScheduleHistoryViewProps) {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  // Force re-render every 30s so relative timestamps stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Sort entries in reverse chronological order
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

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
        <div className="mt-2 space-y-1">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-5">No activity yet</p>
          ) : (
            sorted.map((entry, index) => {
              const badge = EXECUTION_TYPE_BADGES[entry.executionType ?? 'scheduled'];
              const isExpanded = expandedIndex === index;
              const details = entry.details ?? [];
              const matchCount = entry.matchCount ?? 0;
              const hasDetails = details.length > 0;
              const visibleDetails = details.slice(0, MAX_DETAILS_SHOWN);
              const remaining = details.length - MAX_DETAILS_SHOWN;

              return (
                <div key={`${entry.timestamp}-${index}`} className="pl-5">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs w-full text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    aria-label={`${matchCount} tasks`}
                  >
                    {hasDetails && (
                      isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )
                    )}
                    <span
                      data-testid="execution-type-badge"
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${badge?.className ?? ''}`}
                    >
                      {badge?.label ?? '⚡ Scheduled'}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                    <span className="truncate">
                      {entry.actionDescription} · {matchCount} {matchCount === 1 ? 'task' : 'tasks'}
                    </span>
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="ml-5 mt-1 space-y-0.5 pb-1">
                      {visibleDetails.map((taskName, i) => (
                        <div
                          key={i}
                          className="text-xs text-muted-foreground pl-2 border-l-2 border-muted"
                        >
                          {taskName}
                        </div>
                      ))}
                      {remaining > 0 && (
                        <div className="text-xs text-muted-foreground pl-2 italic">
                          +{remaining} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
