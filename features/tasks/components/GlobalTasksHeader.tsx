'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, List, ListTree, CheckCircle2, History, MoreHorizontal } from 'lucide-react';
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
import { TMSModePill } from '@/features/tms/components/TMSModePill';

interface GlobalTasksHeaderProps {
  onAddTask: () => void;
  scrollContainerRef: React.RefObject<HTMLElement>;
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
 * Layout: [Completed · <status>] [Nested/Flat] [TMSModePill] [+ Add Task]
 */
export function GlobalTasksHeader({ onAddTask, scrollContainerRef }: GlobalTasksHeaderProps) {
  const {
    globalTasksDisplayMode, setGlobalTasksDisplayMode,
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

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">All Tasks</h1>

        <div className="ml-auto flex items-center gap-2">
          {isSmallScreen ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
                  <div>{completedButton}</div>
                  <div>{displayModeButton}</div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* TMSModePill stays visible on small screens — primary control */}
              <TMSModePill scrollContainerRef={scrollContainerRef} />
            </>
          ) : (
            <>
              {completedButton}
              {displayModeButton}
              <TMSModePill scrollContainerRef={scrollContainerRef} />
            </>
          )}

          <Button onClick={onAddTask} size="sm" className="bg-accent-brand hover:bg-accent-brand-hover text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>
    </>
  );
}
