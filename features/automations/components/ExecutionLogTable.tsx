'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { EnrichedLogEntry } from '../services/preview/logFilterService';

interface ExecutionLogTableProps {
  entries: EnrichedLogEntry[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  remainingCount?: number;
  onClearFilters?: () => void;
  isEmpty?: boolean;
}

function getStatusInfo(executionType: string | undefined) {
  if (executionType?.includes('skip')) {
    return {
      label: 'Skipped',
      variant: 'outline' as const,
      className: 'text-amber-600 dark:text-amber-400',
    };
  }
  if (executionType === 'error') {
    return {
      label: 'Error',
      variant: 'outline' as const,
      className: 'text-destructive',
    };
  }
  return { label: 'Fired', variant: 'secondary' as const, className: '' };
}

function getRowTint(executionType: string | undefined) {
  if (executionType?.includes('skip')) {
    return 'bg-amber-50/30 dark:bg-amber-950/10';
  }
  if (executionType === 'error') {
    return 'bg-destructive/5';
  }
  return '';
}

export function ExecutionLogTable({
  entries,
  onLoadMore,
  hasMore,
  remainingCount,
  onClearFilters,
  isEmpty,
}: ExecutionLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <Search className="h-8 w-8" />
        <p className="text-sm">No entries match your filters</p>
        {onClearFilters && (
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col text-sm">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          <div className="w-24 shrink-0">Time</div>
          <div className="flex-1 min-w-0">Rule</div>
          <div className="flex-1 min-w-0">Project</div>
          <div className="flex-1 min-w-0">Task</div>
          <div className="w-20 shrink-0 text-right">Status</div>
        </div>

        {/* Rows */}
        {entries.map((entry) => {
          const status = getStatusInfo(entry.executionType);
          const tint = getRowTint(entry.executionType);
          const isExpanded = expandedId === entry.id;

          return (
            <div key={entry.id}>
              <div
                role="button"
                tabIndex={0}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${tint}`}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : entry.id);
                  }
                }}
              >
                <div className="w-24 shrink-0 text-xs text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{entry.timestamp}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex-1 min-w-0 truncate">
                  <button
                    type="button"
                    className="text-left text-primary hover:underline truncate max-w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.ruleName || entry.ruleId || '—'}
                  </button>
                </div>
                <div className="flex-1 min-w-0 truncate text-muted-foreground">
                  {entry.projectName || entry.firingProjectId || '—'}
                </div>
                <div className="flex-1 min-w-0 truncate text-muted-foreground">
                  {entry.taskName || '—'}
                </div>
                <div className="w-20 shrink-0 text-right">
                  <Badge variant={status.variant} className={status.className}>
                    {status.label}
                  </Badge>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-muted/30 border-l-2 border-accent-brand ml-4 px-4 py-2 text-xs space-y-2">
                  {entry.skipReason && (
                    <p className="text-muted-foreground">{entry.skipReason}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                    >
                      Go to project →
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                    >
                      Edit rule →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            className="w-full py-2 text-sm text-primary hover:underline"
            onClick={onLoadMore}
          >
            Load more — {remainingCount} remaining
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}
