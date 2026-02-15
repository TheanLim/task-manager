'use client';

import { Button } from '@/components/ui/button';
import { Plus, List, ListTree, ListChecks, Eye, Info, CheckCircle2, History } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { AutoHideThreshold } from '@/lib/schemas';

interface GlobalTasksHeaderProps {
  onAddTask: () => void;
}

const THRESHOLD_LABELS: Record<AutoHideThreshold, string> = {
  '24h': '24 hours',
  '48h': '48 hours',
  '1w': '1 week',
  'never': 'Never',
};

/**
 * Header component for Global Tasks View.
 * Layout: [Completed · 24h] [Nested/Flat] [Review Queue] [+ Add Task]
 */
export function GlobalTasksHeader({ onAddTask }: GlobalTasksHeaderProps) {
  const {
    globalTasksDisplayMode, setGlobalTasksDisplayMode,
    needsAttentionSort, setNeedsAttentionSort,
    hideCompletedTasks, setHideCompletedTasks,
    autoHideThreshold, setAutoHideThreshold,
    showRecentlyCompleted, setShowRecentlyCompleted,
  } = useAppStore();

  const completedStatusLabel = (() => {
    if (hideCompletedTasks) return 'Hidden';
    if (showRecentlyCompleted) return 'Showing done';
    if (autoHideThreshold === 'never') return 'All visible';
    return THRESHOLD_LABELS[autoHideThreshold];
  })();

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">All Tasks</h1>

        <div className="ml-auto flex items-center gap-2">
          {/* Completed settings popover — hidden when Review Queue is active */}
          {!needsAttentionSort && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {'Completed \u00b7 ' + completedStatusLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-4">
                  <p className="text-sm font-medium">Completed Tasks</p>

                  {/* Hide all completed */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hide-completed"
                      checked={hideCompletedTasks}
                      onCheckedChange={(checked) => setHideCompletedTasks(checked === true)}
                    />
                    <Label htmlFor="hide-completed" className="text-sm font-normal cursor-pointer">
                      Hide all completed
                    </Label>
                  </div>

                  <Separator />

                  {/* Auto-hide threshold */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Auto-hide after</Label>
                    <Select
                      value={autoHideThreshold}
                      onValueChange={(v) => setAutoHideThreshold(v as AutoHideThreshold)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(THRESHOLD_LABELS) as AutoHideThreshold[]).map((key) => (
                          <SelectItem key={key} value={key}>{THRESHOLD_LABELS[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show recently done */}
                  {autoHideThreshold !== 'never' && (
                    <>
                      <Separator />
                      <Button
                        variant={showRecentlyCompleted ? 'default' : 'ghost'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setShowRecentlyCompleted(!showRecentlyCompleted)}
                      >
                        <History className="h-4 w-4 mr-2" />
                        {showRecentlyCompleted ? 'Showing completed' : 'Show recently done'}
                      </Button>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Display mode toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
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

          {/* Review Queue toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={needsAttentionSort ? 'default' : 'outline'}
                  size="sm"
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

          {/* Add task button */}
          <Button onClick={onAddTask} size="sm">
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
