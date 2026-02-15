'use client';

import { Button } from '@/components/ui/button';
import { Plus, List, ListTree, ListChecks, Eye, Info, EyeOff, CheckCircle2, Clock, History } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AutoHideThreshold } from '@/lib/schemas';

interface GlobalTasksHeaderProps {
  onAddTask: () => void;
}

/**
 * Header component for Global Tasks View
 * Includes display mode toggle and add task button
 */
export function GlobalTasksHeader({ onAddTask }: GlobalTasksHeaderProps) {
  const {
    globalTasksDisplayMode, setGlobalTasksDisplayMode,
    needsAttentionSort, setNeedsAttentionSort,
    hideCompletedTasks, setHideCompletedTasks,
    autoHideThreshold, setAutoHideThreshold,
    showRecentlyCompleted, setShowRecentlyCompleted,
  } = useAppStore();

  const THRESHOLD_LABELS: Record<AutoHideThreshold, string> = {
    '24h': '24 hours',
    '48h': '48 hours',
    '1w': '1 week',
    'never': 'Never',
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        
        <div className="ml-auto flex items-center gap-2">
          {/* Needs Attention sort toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={needsAttentionSort ? "default" : "outline"}
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
                    ? 'Reviewing tasks — oldest-reviewed on top. Click ↻ to mark reviewed.'
                    : 'Sort by last reviewed — oldest first'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Hide completed toggle — only in Normal mode (Reviewing auto-hides) */}
          {!needsAttentionSort && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={hideCompletedTasks ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHideCompletedTasks(!hideCompletedTasks)}
                  >
                    {hideCompletedTasks ? <EyeOff className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {hideCompletedTasks ? 'Completed hidden' : 'Hide completed'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{hideCompletedTasks ? 'Show completed tasks' : 'Hide completed tasks'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Auto-hide threshold — only when not in Review Queue */}
          {!needsAttentionSort && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    <Select
                      value={autoHideThreshold}
                      onValueChange={(v) => setAutoHideThreshold(v as AutoHideThreshold)}
                    >
                      <SelectTrigger className="h-8 w-[100px] text-xs border-dashed">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(THRESHOLD_LABELS) as AutoHideThreshold[]).map((key) => (
                          <SelectItem key={key} value={key}>{THRESHOLD_LABELS[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Auto-hide completed tasks older than this</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Recently completed toggle — only when threshold is not 'never' and not in Review Queue */}
          {!needsAttentionSort && autoHideThreshold !== 'never' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showRecentlyCompleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowRecentlyCompleted(!showRecentlyCompleted)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    {showRecentlyCompleted ? 'Showing completed' : 'Recently done'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showRecentlyCompleted ? 'Return to active tasks' : 'Show tasks auto-hidden after completion'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                    <>
                      <ListTree className="h-4 w-4 mr-2" />
                      Nested
                    </>
                  ) : (
                    <>
                      <List className="h-4 w-4 mr-2" />
                      Flat
                    </>
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
              ? 'Each task is sorted individually by last reviewed — subtasks appear on their own, not grouped under parents'
              : 'Sorted by last reviewed — task order here is independent of project views'}
          </span>
        </div>
      )}
    </>
  );
}
