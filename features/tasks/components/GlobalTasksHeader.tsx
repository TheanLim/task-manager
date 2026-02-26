'use client';

import { Button } from '@/components/ui/button';
import { Plus, List, ListTree, ListChecks, Eye, Info, CheckCircle2, History, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AutoHideThreshold } from '@/lib/schemas';

interface GlobalTasksHeaderProps {
  onAddTask: () => void;
}

const THRESHOLD_OPTIONS: { value: AutoHideThreshold; label: string }[] = [
  { value: 'show-all',  label: 'Show all' },
  { value: '24h',       label: 'Hide after 24 hours' },
  { value: '48h',       label: 'Hide after 48 hours' },
  { value: '1w',        label: 'Hide after 1 week' },
  { value: 'always',    label: 'Always hide' },
];

/**
 * Header component for Global Tasks View.
 * Layout: [Completed · <status>] [Nested/Flat] [Review Queue] [+ Add Task]
 */
export function GlobalTasksHeader({ onAddTask }: GlobalTasksHeaderProps) {
  const {
    globalTasksDisplayMode, setGlobalTasksDisplayMode,
    needsAttentionSort, setNeedsAttentionSort,
    autoHideThreshold, setAutoHideThreshold,
    showRecentlyCompleted, setShowRecentlyCompleted,
  } = useAppStore();

  const isSmallScreen = useMediaQuery('(max-width: 767px)');

  const completedStatusLabel = (() => {
    if (autoHideThreshold === 'always') return 'Hidden';
    if (autoHideThreshold === 'show-all') return 'All';
    if (showRecentlyCompleted) return 'Recent';
    const labels: Record<string, string> = { '24h': '24h', '48h': '48h', '1w': '1 week' };
    return labels[autoHideThreshold] ?? autoHideThreshold;
  })();

  // Show recently completed toggle only for time-based thresholds
  const showToggle = autoHideThreshold !== 'always' && autoHideThreshold !== 'show-all';

  const completedButton = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={isSmallScreen ? 'w-full justify-start' : ''}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {`Completed \u00b7 ${completedStatusLabel}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Completed tasks</Label>
            <Select
              value={autoHideThreshold}
              onValueChange={(v) => setAutoHideThreshold(v as AutoHideThreshold)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showToggle && (
            <Button
              variant={showRecentlyCompleted ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowRecentlyCompleted(!showRecentlyCompleted)}
            >
              <History className="h-4 w-4 mr-2" />
              {showRecentlyCompleted ? 'Showing recently completed' : 'Show recently completed'}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  const displayModeButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={isSmallScreen ? 'w-full justify-start' : ''}
            onClick={() => setGlobalTasksDisplayMode(
              globalTasksDisplayMode === 'nested' ? 'flat' : 'nested'
            )}
          >
            {globalTasksDisplayMode === 'nested' ? (
              <><ListTree className="h-4 w-4 mr-2" />Nested</>
            ) : (
              <><List className="h-4 w-4 mr-2" />Flat</>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {globalTasksDisplayMode === 'nested'
              ? 'Switch to flat view (all tasks at same level)'
              : 'Switch to nested view (subtasks indented)'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const reviewQueueButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={needsAttentionSort ? 'default' : 'outline'}
            size="sm"
            className={isSmallScreen ? 'w-full justify-start' : ''}
            onClick={() => setNeedsAttentionSort(!needsAttentionSort)}
          >
            {needsAttentionSort ? <Eye className="h-4 w-4 mr-2" /> : <ListChecks className="h-4 w-4 mr-2" />}
            {needsAttentionSort ? 'Reviewing' : 'Review Queue'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {needsAttentionSort
              ? 'Reviewing tasks \u2014 oldest-reviewed on top. Click \u21bb to mark reviewed.'
              : 'Sort by last reviewed \u2014 oldest first'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">All Tasks</h1>

        <div className="ml-auto flex items-center gap-2">
          {isSmallScreen ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                {!needsAttentionSort && (
                  <div>{completedButton}</div>
                )}
                <div>{displayModeButton}</div>
                <div>{reviewQueueButton}</div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {!needsAttentionSort && completedButton}
              {displayModeButton}
              {reviewQueueButton}
            </>
          )}

          <Button onClick={onAddTask} size="sm" className="bg-accent-brand hover:bg-accent-brand-hover text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {needsAttentionSort && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {globalTasksDisplayMode === 'flat'
              ? 'Each task is sorted individually by last reviewed \u2014 subtasks appear on their own, not grouped under parents'
              : 'Sorted by last reviewed \u2014 task order here is independent of project views'}
          </span>
        </div>
      )}
    </>
  );
}
